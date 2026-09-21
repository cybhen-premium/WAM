"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { EVENT_TYPES } from "@/lib/constants";

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function createEvent(_prev: FormState, f: FormData): Promise<FormState> {
  const { church } = await requireChurch();
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const title = s("title");
  const date = s("date");
  const start = /^\d{2}:\d{2}$/.test(s("start")) ? s("start") : "00:00";
  const end = /^\d{2}:\d{2}$/.test(s("end")) ? s("end") : "";
  const type = (EVENT_TYPES as readonly string[]).includes(s("type")) ? s("type") : "Other";

  if (!title) return { error: "Event title is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date." };
  if (end && end <= start) return { error: "End time must be after the start time." };

  await db.insert(schema.event).values({
    churchId: church.id,
    title,
    type,
    location: s("location") || null,
    description: s("notes") || null,
    startsAt: `${date} ${start}:00`,
    endsAt: end ? `${date} ${end}:00` : null,
  });
  revalidatePath("/events");
  revalidatePath("/event-analytics");
  revalidatePath("/attendance");
  return { ok: true };
}

export async function deleteEvent(id: string) {
  const { church } = await requireChurch();
  await db.delete(schema.event).where(and(eq(schema.event.id, id), eq(schema.event.churchId, church.id)));
  revalidatePath("/events");
  revalidatePath("/event-analytics");
}
