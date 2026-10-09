import "dotenv/config";
import { db, schema } from "../src/db";
import { eq } from "drizzle-orm";

async function main() {
  const [inq] = await db.select().from(schema.memberInquiry).where(eq(schema.memberInquiry.status, "pending")).limit(1);
  if (!inq) {
    console.log("No pending inquiry found.");
    return;
  }

  const replyText = "Hello Melvin, Wednesday cell fellowship will be held at Bro. Emmanuel's residence at 6:30 PM. God bless you!";

  await db
    .update(schema.memberInquiry)
    .set({
      reply: replyText,
      repliedBy: "Pastor Adom",
      repliedAt: new Date(),
      status: "resolved",
    })
    .where(eq(schema.memberInquiry.id, inq.id));

  await db.insert(schema.memberNotification).values({
    memberId: inq.memberId,
    title: `Pastoral Reply: ${inq.subject}`,
    message: replyText,
    type: "inquiry_reply",
    read: false,
  });

  console.log("Successfully replied to inquiry and created portal notification.");
}

main().catch(console.error);
