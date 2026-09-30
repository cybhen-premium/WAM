"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";

const { followUp, member } = schema;
const STAGES = ["new", "contacted", "visited", "integrated"] as const;
type Stage = (typeof STAGES)[number];

export type FormState = { error?: string; ok?: boolean } | undefined;

function refresh() {
  revalidatePath("/follow-up");
  revalidatePath("/welfare");
}

export async function addToPipeline(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("care");
  const { church } = await requireChurch();
  const memberId = String(f.get("memberId") ?? "");
  const [m] = await db
    .select({ id: member.id, category: member.category })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.churchId, church.id)))
    .limit(1);
  if (!m) return { error: "Select a member." };
  // The pipeline is for Akwaaba visitors only.
  if (m.category !== "Visitor") return { error: "Only visitors can be added to the follow-up pipeline." };

  await db.insert(followUp).values({
    churchId: church.id,
    memberId: m.id,
    kind: "convert",
    assignedTo: String(f.get("assignedTo") ?? "").trim() || null,
    notes: String(f.get("notes") ?? "").trim() || null,
  });
  refresh();
  return { ok: true };
}

export async function moveStage(id: string, stage: Stage) {
  await requireModule("care");
  const { church } = await requireChurch();
  if (!STAGES.includes(stage)) return;
  await db
    .update(followUp)
    .set({ stage, updatedAt: new Date() })
    .where(and(eq(followUp.id, id), eq(followUp.churchId, church.id)));
  refresh();
}

export async function updateNotes(id: string, notes: string, assignedTo: string) {
  await requireModule("care");
  const { church } = await requireChurch();
  await db
    .update(followUp)
    .set({ notes: notes.trim() || null, assignedTo: assignedTo.trim() || null, updatedAt: new Date() })
    .where(and(eq(followUp.id, id), eq(followUp.churchId, church.id)));
  refresh();
}

export async function removeFromPipeline(id: string) {
  await requireModule("care");
  const { church } = await requireChurch();
  await db.delete(followUp).where(and(eq(followUp.id, id), eq(followUp.churchId, church.id)));
  refresh();
}
