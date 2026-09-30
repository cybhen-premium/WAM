"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";

const { sobProgress, member } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

const SOB_LESSONS = 4;

/** Mark a lesson as complete for a member. Auto-baptises when lesson 4 (Baptised) is done. */
export async function completeSobLesson(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("sob");
  const { church } = await requireChurch();
  const memberId = String(form.get("memberId") ?? "");
  const lesson = Number(form.get("lesson") ?? 0);
  const date = String(form.get("date") ?? new Date().toISOString().slice(0, 10));

  if (!memberId || lesson < 1 || lesson > SOB_LESSONS) {
    return { error: "Invalid data provided." };
  }

  // Upsert the lesson completion (ignore if already exists)
  await db
    .insert(sobProgress)
    .values({ churchId: church.id, memberId, lesson, completedAt: date })
    .onConflictDoNothing();

  // If lesson 4 (Baptised) is completed, mark as baptized and graduate to full membership
  if (lesson === 4) {
    // Graduate them only if they are still a Visitor / Regular Attendee
    const [current] = await db
      .select({ category: member.category })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)))
      .limit(1);
    const graduating =
      current?.category === "Visitor" || current?.category === "Regular Attendee";
    await db
      .update(member)
      .set({
        baptized: true,
        ...(graduating
          ? { category: "General Member", convertedAt: date }
          : {}),
      })
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)));
  }

  revalidatePath("/sob");
  revalidatePath("/members");
  revalidatePath("/akwaaba");
  revalidatePath("/dashboard");
  revalidatePath("/visitor-conversion");
  revalidatePath("/follow-up");
  return { ok: true };
}

/** Undo a completed lesson */
export async function undoSobLesson(memberId: string, lesson: number): Promise<void> {
  await requireModule("sob");
  const { church } = await requireChurch();

  await db
    .delete(sobProgress)
    .where(
      and(
        eq(sobProgress.memberId, memberId),
        eq(sobProgress.lesson, lesson),
        eq(sobProgress.churchId, church.id),
      ),
    );

  // If lesson 4 (Baptised) is undone, revoke baptism status.
  // If they had auto-graduated to General Member on baptism, move them back to Regular Attendee.
  if (lesson === 4) {
    const [current] = await db
      .select({ id: member.id, category: member.category, convertedAt: member.convertedAt })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)))
      .limit(1);
    if (current) {
      // lessonsLeft is queried AFTER the delete above, so lesson 4 is already gone.
      // If lessons 1-3 are also gone, this person has no SOB history left and a
      // full-member category could only have come from the auto-graduation.
      const lessonsLeft = await db
        .select({ lesson: sobProgress.lesson })
        .from(sobProgress)
        .where(and(eq(sobProgress.memberId, memberId), eq(sobProgress.churchId, church.id)));
      const hadAutoGraduated =
        current.category !== "Visitor" &&
        current.category !== "Regular Attendee" &&
        lessonsLeft.length === 0;
      await db
        .update(member)
        .set({
          baptized: false,
          ...(hadAutoGraduated ? { category: "Regular Attendee", convertedAt: null } : {}),
        })
        .where(and(eq(member.id, memberId), eq(member.churchId, church.id)));
    }
  }

  revalidatePath("/sob");
  revalidatePath("/sob/history");
  revalidatePath("/members");
  revalidatePath("/akwaaba");
  revalidatePath("/dashboard");
}
