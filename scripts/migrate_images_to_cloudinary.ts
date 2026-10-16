import "dotenv/config";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";
import { uploadImageToCloudinary } from "../src/lib/cloudinary";

async function migrateImages() {
  console.log("=== Checking for Base64 Images in Database ===");

  // 1. Church Logos
  const churches = await db
    .select({
      id: schema.church.id,
      name: schema.church.name,
      logoUrl: schema.church.logoUrl,
    })
    .from(schema.church);

  let churchesUpdated = 0;
  for (const c of churches) {
    if (c.logoUrl && c.logoUrl.startsWith("data:")) {
      console.log(`Migrating logo for church: "${c.name}" (base64 size: ~${Math.round(c.logoUrl.length / 1024)} KB)...`);
      try {
        const uploaded = await uploadImageToCloudinary(c.logoUrl, "churchy/branding");
        await db
          .update(schema.church)
          .set({ logoUrl: uploaded.url })
          .where(eq(schema.church.id, c.id));
        console.log(` -> Successfully migrated church logo to: ${uploaded.url}`);
        churchesUpdated++;
      } catch (err: any) {
        console.error(` -> Failed to migrate logo for church "${c.name}":`, err?.message || err);
      }
    }
  }
  console.log(`Total church logos migrated: ${churchesUpdated}`);

  // 2. Member Photos
  const members = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      photoUrl: schema.member.photoUrl,
    })
    .from(schema.member);

  let membersUpdated = 0;
  for (const m of members) {
    if (m.photoUrl && m.photoUrl.startsWith("data:")) {
      console.log(`Migrating photo for member: "${m.fullName}" (base64 size: ~${Math.round(m.photoUrl.length / 1024)} KB)...`);
      try {
        const uploaded = await uploadImageToCloudinary(m.photoUrl, "churchy/members");
        await db
          .update(schema.member)
          .set({ photoUrl: uploaded.url })
          .where(eq(schema.member.id, m.id));
        console.log(` -> Successfully migrated photo for "${m.fullName}" to: ${uploaded.url}`);
        membersUpdated++;
      } catch (err: any) {
        console.error(` -> Failed to migrate photo for member "${m.fullName}":`, err?.message || err);
      }
    }
  }
  console.log(`Total member photos migrated: ${membersUpdated}`);

  console.log("=== Image Migration Finished ===");
}

migrateImages().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
