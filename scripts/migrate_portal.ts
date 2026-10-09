import "dotenv/config";
import { db, schema } from "../src/db";
import { sql, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

function generateCode(prefix: string) {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
}

async function main() {
  try {
    console.log("Applying member portal database migration...");
    const migrationSql = fs.readFileSync(
      path.resolve("drizzle/0020_member_portal.sql"),
      "utf8"
    );

    // Split statements and execute individually for Neon HTTP
    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.execute(sql.raw(stmt));
    }
    console.log("All migration statements executed successfully!");

    // Backfill existing members
    const members = await db.select({
      id: schema.member.id,
      name: schema.member.fullName,
      churchId: schema.member.churchId,
      existingCode: schema.member.memberIdCode,
    }).from(schema.member);

    console.log(`Found ${members.length} members. Checking member ID codes...`);
    for (const m of members) {
      if (!m.existingCode) {
        const [ch] = await db.select({ name: schema.church.name }).from(schema.church).where(eq(schema.church.id, m.churchId)).limit(1);
        let prefix = "WAM";
        if (ch?.name) {
          const initials = ch.name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase();
          if (initials.length >= 2 && initials.length <= 5) prefix = initials;
        }

        let code = generateCode(prefix);
        let attempts = 0;
        while (attempts < 10) {
          const [exists] = await db.select({ id: schema.member.id }).from(schema.member).where(eq(schema.member.memberIdCode, code)).limit(1);
          if (!exists) break;
          code = generateCode(prefix);
          attempts++;
        }

        await db.update(schema.member).set({ memberIdCode: code }).where(eq(schema.member.id, m.id));
        console.log(`Assigned code ${code} to member ${m.name} (${m.id})`);
      } else {
        console.log(`Member ${m.name} already has code ${m.existingCode}`);
      }
    }

    console.log("Migration and backfill complete!");
  } catch (err) {
    console.error("Migration error:", err);
  }
  process.exit(0);
}

main();
