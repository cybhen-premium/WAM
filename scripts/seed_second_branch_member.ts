import "dotenv/config";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  const centralBranchId = "cdddcdcf-5340-4b51-bb21-849c5f4a9830"; // World Ark Missions

  const [existing] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.churchId, centralBranchId))
    .limit(1);

  if (existing) {
    console.log("Central branch already has a member:", existing.fullName, existing.memberIdCode);
    return;
  }

  // Create a member in the central branch
  const code = "WAM-7K9P";
  const [newMember] = await db
    .insert(schema.member)
    .values({
      churchId: centralBranchId,
      fullName: "Abigail Mensah",
      phone: "0241234567",
      email: "abigail.mensah@example.com",
      category: "Choir",
      memberIdCode: code,
      active: true,
      portalActive: false,
    })
    .returning();

  console.log("Created central branch member:", newMember.fullName, newMember.memberIdCode);
}

main().catch(console.error);
