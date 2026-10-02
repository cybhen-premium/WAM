"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * A visitor decides to stay: move them into the School of Baptism journey. They become a
 * "Regular Attendee" (the category the SOB page tracks) and their visitor follow-up is closed.
 * The final member category is decided later, when SOB lesson 4 (Baptised) graduates them.
 */
export async function moveToSob(memberId: string) {
  await requireModule("analytics");
  const { church } = await requireChurch();

  const updated = await db
    .update(schema.member)
    .set({ category: "Regular Attendee" })
    .where(
      and(
        eq(schema.member.id, memberId),
        eq(schema.member.churchId, church.id),
        eq(schema.member.category, "Visitor"),
      ),
    )
    .returning({ id: schema.member.id, fullName: schema.member.fullName });

  if (updated.length) {
    await db
      .update(schema.followUp)
      .set({ stage: "integrated", updatedAt: new Date() })
      .where(and(eq(schema.followUp.memberId, memberId), eq(schema.followUp.kind, "convert")));

    logActivity({
      module: "care",
      actionCode: "care.sob_enroll",
      action: `Moved "${updated[0].fullName}" to School of Baptism`,
      metadata: { memberId, name: updated[0].fullName },
    });
  }

  revalidatePath("/visitor-conversion");
  revalidatePath("/akwaaba");
  revalidatePath("/sob");
  revalidatePath("/members");
  revalidatePath("/follow-up");
}
