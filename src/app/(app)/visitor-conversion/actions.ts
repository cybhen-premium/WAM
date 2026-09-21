"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { MEMBER_CATEGORIES } from "@/lib/constants";

/** Converts a visitor to a regular member category and marks their follow-up as integrated. */
export async function convertVisitor(memberId: string, category: string) {
  const { church } = await requireChurch();
  const target = (MEMBER_CATEGORIES as readonly string[]).includes(category) && category !== "Visitor" ? category : "General Member";

  const updated = await db
    .update(schema.member)
    .set({ category: target, convertedAt: new Date().toISOString().slice(0, 10) })
    .where(and(eq(schema.member.id, memberId), eq(schema.member.churchId, church.id), eq(schema.member.category, "Visitor")))
    .returning({ id: schema.member.id });

  if (updated.length) {
    await db
      .update(schema.followUp)
      .set({ stage: "integrated", updatedAt: new Date() })
      .where(and(eq(schema.followUp.memberId, memberId), eq(schema.followUp.kind, "convert")));
  }
  revalidatePath("/visitor-conversion");
  revalidatePath("/members");
  revalidatePath("/follow-up");
}
