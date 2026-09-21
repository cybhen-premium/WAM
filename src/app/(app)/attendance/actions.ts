"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";

const { attendance, event, member } = schema;

export type CheckInResult =
  | { ok: true; name: string; already: boolean }
  | { ok: false; error: string };

/** Checks a member into an event. `memberRef` is a member id, or a scanned QR payload "ES:<id>". */
export async function checkIn(eventId: string, memberRef: string): Promise<CheckInResult> {
  const { church } = await requireChurch();
  const memberId = memberRef.replace(/^ES:/, "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) return { ok: false, error: "Unrecognised code." };

  const [[ev], [m]] = await Promise.all([
    db
      .select({ id: event.id, startsAt: event.startsAt })
      .from(event)
      .where(and(eq(event.id, eventId), eq(event.churchId, church.id)))
      .limit(1),
    db
      .select({ id: member.id, fullName: member.fullName })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.churchId, church.id)))
      .limit(1),
  ]);
  if (!ev) return { ok: false, error: "Select an event first." };
  if (!m) return { ok: false, error: "This code doesn't belong to a member of this church." };

  const serviceDate = ev.startsAt.slice(0, 10);
  const inserted = await db
    .insert(attendance)
    .values({ churchId: church.id, memberId: m.id, eventId: ev.id, serviceDate })
    .onConflictDoNothing()
    .returning({ id: attendance.id });

  await db
    .update(member)
    .set({ lastAttendedAt: sql`greatest(coalesce(${member.lastAttendedAt}, ${serviceDate}::date), ${serviceDate}::date)` })
    .where(eq(member.id, m.id));

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return { ok: true, name: m.fullName, already: inserted.length === 0 };
}

export async function undoCheckIn(eventId: string, memberId: string) {
  const { church } = await requireChurch();
  await db
    .delete(attendance)
    .where(and(eq(attendance.churchId, church.id), eq(attendance.eventId, eventId), eq(attendance.memberId, memberId)));
  revalidatePath("/attendance");
}
