import "dotenv/config";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";

async function main() {
  const inquiries = await db.select().from(schema.memberInquiry);
  console.log("Total inquiries found:", inquiries.length);
  for (const inq of inquiries) {
    console.log(`- [${inq.status}] ${inq.subject} (${inq.category}): ${inq.message}`);
  }
}

main().catch(console.error);
