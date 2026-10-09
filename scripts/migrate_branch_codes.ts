import "dotenv/config";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function getBranchPrefix(churchName?: string): string {
  if (!churchName) return "WAM";
  const lower = churchName.toLowerCase();
  if (lower.includes("holy spirit") || lower.includes("citadel")) {
    return "HSC";
  }
  if (lower.includes("world ark")) {
    return "WAM";
  }
  return "WAM";
}

async function generateMemberIdCode(prefix: string): Promise<string> {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let attempts = 0;
  while (attempts < 20) {
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(crypto.randomInt(0, chars.length));
    }
    const candidate = `${prefix}-${rand}`;
    const [existing] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.memberIdCode, candidate))
      .limit(1);

    if (!existing) return candidate;
    attempts++;
  }
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

async function main() {
  console.log("Checking and syncing member ID prefixes across church branches...");

  const members = await db
    .select({
      id: schema.member.id,
      name: schema.member.fullName,
      churchId: schema.member.churchId,
      code: schema.member.memberIdCode,
    })
    .from(schema.member);

  const churches = await db.select().from(schema.church);
  const churchMap = new Map(churches.map((c) => [c.id, c]));

  console.log(`Found ${members.length} members across ${churches.length} branches.`);

  for (const m of members) {
    const ch = churchMap.get(m.churchId);
    const expectedPrefix = getBranchPrefix(ch?.name);
    console.log(`Branch: "${ch?.name}" -> Expected Prefix: "${expectedPrefix}"`);

    if (!m.code) {
      const newCode = await generateMemberIdCode(expectedPrefix);
      await db.update(schema.member).set({ memberIdCode: newCode }).where(eq(schema.member.id, m.id));
      console.log(`[ASSIGNED] ${m.name} -> ${newCode}`);
    } else {
      const currentPrefix = m.code.split("-")[0];
      if (currentPrefix !== expectedPrefix) {
        // e.g. WAM-D5PH -> HSC-D5PH
        const suffix = m.code.split("-").slice(1).join("-");
        const updatedCode = `${expectedPrefix}-${suffix}`;

        // Check if collision
        const [exists] = await db
          .select({ id: schema.member.id })
          .from(schema.member)
          .where(eq(schema.member.memberIdCode, updatedCode))
          .limit(1);

        const finalCode = exists ? await generateMemberIdCode(expectedPrefix) : updatedCode;

        await db.update(schema.member).set({ memberIdCode: finalCode }).where(eq(schema.member.id, m.id));
        console.log(`[UPDATED] ${m.name}: ${m.code} -> ${finalCode} (Branch: ${ch?.name})`);
      } else {
        console.log(`[OK] ${m.name}: ${m.code} already matches ${expectedPrefix}`);
      }
    }
  }

  console.log("Member branch prefix synchronization complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
