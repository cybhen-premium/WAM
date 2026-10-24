"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const { sobProgress, sobLesson, member } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

export type SobLessonItem = {
  id: string;
  churchId: string;
  lessonNumber: number;
  title: string;
  description: string | null;
  isGraduation: boolean;
};

/** Get or seed default SOB lessons for a church */
export async function getOrSeedSobLessons(churchId: string): Promise<SobLessonItem[]> {
  let lessons = await db
    .select({
      id: sobLesson.id,
      churchId: sobLesson.churchId,
      lessonNumber: sobLesson.lessonNumber,
      title: sobLesson.title,
      description: sobLesson.description,
      isGraduation: sobLesson.isGraduation,
    })
    .from(sobLesson)
    .where(eq(sobLesson.churchId, churchId))
    .orderBy(sobLesson.lessonNumber);

  if (lessons.length === 0) {
    const defaults = [
      {
        churchId,
        lessonNumber: 1,
        title: "Lesson 1 — The Fall of Man & Redemption Plan",
        description: "Understanding salvation, the fall, and God's redemption plan.",
        isGraduation: false,
      },
      {
        churchId,
        lessonNumber: 2,
        title: "Lesson 2 — Water Baptism",
        description: "The significance of identification with Christ in water baptism.",
        isGraduation: false,
      },
      {
        churchId,
        lessonNumber: 3,
        title: "Lesson 3 — Holy Spirit Baptism",
        description: "The promise of the Father and receiving the Holy Spirit.",
        isGraduation: false,
      },
      {
        churchId,
        lessonNumber: 4,
        title: "Baptised",
        description: "Water baptism ceremony and graduation to full church membership.",
        isGraduation: true,
      },
    ];
    await db.insert(sobLesson).values(defaults).onConflictDoNothing();
    lessons = await db
      .select({
        id: sobLesson.id,
        churchId: sobLesson.churchId,
        lessonNumber: sobLesson.lessonNumber,
        title: sobLesson.title,
        description: sobLesson.description,
        isGraduation: sobLesson.isGraduation,
      })
      .from(sobLesson)
      .where(eq(sobLesson.churchId, churchId))
      .orderBy(sobLesson.lessonNumber);
  }

  return lessons;
}

/** Add a new lesson to the SOB curriculum */
export async function createSobLesson(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("sob");
  const { church } = await requireChurch();

  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const isGraduation = form.get("isGraduation") === "true" || form.get("isGraduation") === "on";

  if (!title) {
    return { error: "Please enter a lesson title." };
  }

  const existingLessons = await getOrSeedSobLessons(church.id);
  const nextNumber = existingLessons.length > 0
    ? Math.max(...existingLessons.map((l) => l.lessonNumber)) + 1
    : 1;

  if (isGraduation) {
    // Unset isGraduation on any other lessons for this church
    await db
      .update(sobLesson)
      .set({ isGraduation: false, updatedAt: new Date() })
      .where(eq(sobLesson.churchId, church.id));
  }

  await db.insert(sobLesson).values({
    churchId: church.id,
    lessonNumber: nextNumber,
    title,
    description,
    isGraduation,
  });

  logActivity({
    module: "sob",
    actionCode: "sob.lesson.create",
    action: `Added SOB Lesson ${nextNumber}: "${title}"`,
    metadata: { lessonNumber: nextNumber, title, isGraduation },
  });

  revalidatePath("/sob");
  revalidatePath("/sob/history");
  revalidatePath("/members");
  return { ok: true };
}

/** Update an existing lesson in the SOB curriculum */
export async function updateSobLesson(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("sob");
  const { church } = await requireChurch();

  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const isGraduation = form.get("isGraduation") === "true" || form.get("isGraduation") === "on";

  if (!id || !title) {
    return { error: "Please provide a valid lesson title." };
  }

  const [existing] = await db
    .select()
    .from(sobLesson)
    .where(and(eq(sobLesson.id, id), eq(sobLesson.churchId, church.id)))
    .limit(1);

  if (!existing) {
    return { error: "Lesson not found." };
  }

  if (isGraduation) {
    await db
      .update(sobLesson)
      .set({ isGraduation: false, updatedAt: new Date() })
      .where(eq(sobLesson.churchId, church.id));
  }

  await db
    .update(sobLesson)
    .set({
      title,
      description,
      isGraduation,
      updatedAt: new Date(),
    })
    .where(and(eq(sobLesson.id, id), eq(sobLesson.churchId, church.id)));

  logActivity({
    module: "sob",
    actionCode: "sob.lesson.update",
    action: `Updated SOB Lesson ${existing.lessonNumber}: "${title}"`,
    metadata: { lessonNumber: existing.lessonNumber, title, isGraduation },
  });

  revalidatePath("/sob");
  revalidatePath("/sob/history");
  revalidatePath("/members");
  return { ok: true };
}

/** Delete an SOB lesson (only if no members have recorded completion for it) */
export async function deleteSobLesson(lessonId: string): Promise<FormState> {
  await requireModule("sob");
  const { church } = await requireChurch();

  const [existing] = await db
    .select()
    .from(sobLesson)
    .where(and(eq(sobLesson.id, lessonId), eq(sobLesson.churchId, church.id)))
    .limit(1);

  if (!existing) {
    return { error: "Lesson not found." };
  }

  // Check if any member completed this lesson
  const completions = await db
    .select({ count: sql<number>`count(*)` })
    .from(sobProgress)
    .where(
      and(
        eq(sobProgress.churchId, church.id),
        eq(sobProgress.lesson, existing.lessonNumber),
      ),
    );

  const completedCount = Number(completions[0]?.count ?? 0);
  if (completedCount > 0) {
    return {
      error: `Cannot delete Lesson ${existing.lessonNumber} because ${completedCount} member(s) have already recorded completion for it. You can edit the lesson title or description instead.`,
    };
  }

  await db
    .delete(sobLesson)
    .where(and(eq(sobLesson.id, lessonId), eq(sobLesson.churchId, church.id)));

  logActivity({
    module: "sob",
    actionCode: "sob.lesson.delete",
    action: `Deleted SOB Lesson ${existing.lessonNumber}: "${existing.title}"`,
    metadata: { lessonNumber: existing.lessonNumber, title: existing.title },
  });

  revalidatePath("/sob");
  revalidatePath("/sob/history");
  revalidatePath("/members");
  return { ok: true };
}

/** Mark a lesson as complete for a member. Auto-baptises when graduation lesson is completed. */
export async function completeSobLesson(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("sob");
  const { church } = await requireChurch();
  const memberId = String(form.get("memberId") ?? "");
  const lesson = Number(form.get("lesson") ?? 0);
  const date = String(form.get("date") ?? new Date().toISOString().slice(0, 10));

  if (!memberId || lesson < 1) {
    return { error: "Invalid data provided." };
  }

  const lessons = await getOrSeedSobLessons(church.id);
  const targetLesson = lessons.find((l) => l.lessonNumber === lesson);
  if (!targetLesson) {
    return { error: "Lesson not recognized." };
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

  // Check if this lesson is graduation / baptism
  const isGraduationLesson = targetLesson.isGraduation || (lessons.length > 0 && lesson === lessons[lessons.length - 1].lessonNumber);

  if (isGraduationLesson) {
    const graduating = m?.category === "Visitor" || m?.category === "Regular Attendee";
    await db
      .update(member)
      .set({
        baptized: true,
        ...(graduating
          ? {
              category: "General Member",
              convertedAt: date,
            }
          : {}),
      })
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)));
  }

  logActivity({
    module: "sob",
    actionCode: "sob.complete",
    action: `Completed SOB Lesson ${lesson} (${targetLesson.title}) for ${m?.fullName || "member"}`,
    metadata: { memberId, memberName: m?.fullName, lesson, date },
  });

  revalidatePath("/sob");
  revalidatePath("/sob/history");
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

  const lessons = await getOrSeedSobLessons(church.id);
  const targetLesson = lessons.find((l) => l.lessonNumber === lesson);
  const isGraduationLesson = targetLesson?.isGraduation || (lessons.length > 0 && lesson === lessons[lessons.length - 1].lessonNumber);

  await db
    .delete(sobProgress)
    .where(
      and(
        eq(sobProgress.memberId, memberId),
        eq(sobProgress.lesson, lesson),
        eq(sobProgress.churchId, church.id),
      ),
    );

  // If graduation lesson is undone, revoke baptism status and revert category if they had auto-graduated
  if (isGraduationLesson) {
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
        current.convertedAt !== null;
      await db
        .update(member)
        .set({
          baptized: false,
          baptismStatus: "Not Baptized",
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
