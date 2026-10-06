"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const { sobProgress, member } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

const SOB_LESSONS = 4;
const LESSON_NAMES: Record<number, string> = {
  1: "Salvation",
  2: "The Holy Spirit",
  3: "Christian Living",
  4: "Water Baptism",
};

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

  const [m] = await db
    .select({ fullName: member.fullName, category: member.category })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.churchId, church.id)))
    .limit(1);

  // If lesson 4 (Baptised) is completed, mark as baptized and graduate to full membership
  if (lesson === 4) {
    const graduating =
      m?.category === "Visitor" || m?.category === "Regular Attendee";
    await db
      .update(member)
      .set({
        baptized: true,
        ...(graduating
          ? {
              category: "General Member",
              convertedAt: date,
              akwaabaStatus: m?.category === "Visitor" ? "visiting" : "staying",
            }
          : {}),
      })
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)));
  }

  logActivity({
    module: "sob",
    actionCode: "sob.complete",
    action: `Completed SOB Lesson ${lesson} (${LESSON_NAMES[lesson] || "Lesson"}) for ${m?.fullName || "member"}`,
    metadata: { memberId, memberName: m?.fullName, lesson, date },
  });

  revalidatePath("/sob");
  revalidatePath("/members");
  revalidatePath("/akwaaba");
  revalidatePath("/dashboard");
  revalidatePath("/visitor-conversion");

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
  if (lesson === 4) {
    const [current] = await db
      .select({ id: member.id, category: member.category, convertedAt: member.convertedAt, fullName: member.fullName })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)))
      .limit(1);
    if (current) {
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

  logActivity({
    module: "sob",
    actionCode: "sob.undo",
    action: `Undid SOB Lesson ${lesson} completion`,
    metadata: { memberId, lesson },
  });

  revalidatePath("/sob");
  revalidatePath("/sob/history");
  revalidatePath("/members");
  revalidatePath("/akwaaba");
  revalidatePath("/dashboard");
}
