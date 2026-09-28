"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";

const { sobProgress, member } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

const SOB_LESSONS = 4;

/** Mark a lesson as complete for a member. Auto-baptises when lesson 4 (Baptised) is done. */
export async function completeSobLesson(_prev: FormState, form: FormData): Promise<FormState> {
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

  // If lesson 4 (Baptised) is completed, mark as baptized
  if (lesson === 4) {
    await db
      .update(member)
      .set({ baptized: true })
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)));
  }

  revalidatePath("/sob");
  revalidatePath("/members");
  return { ok: true };
}

/** Undo a completed lesson */
export async function undoSobLesson(memberId: string, lesson: number): Promise<void> {
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

  // If lesson 4 (Baptised) is undone, revoke baptism status
  if (lesson === 4) {
    await db
      .update(member)
      .set({ baptized: false })
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id), eq(member.baptized, true)));
  }

  revalidatePath("/sob");
  revalidatePath("/members");
}
