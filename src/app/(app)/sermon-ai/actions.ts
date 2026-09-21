"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { AiError, runAi } from "@/lib/ai";

type Result = { text?: string; error?: string };

const PASTOR =
  "You are a seasoned, theologically careful pastoral assistant for a Christian church in Ghana. " +
  "Use accurate Bible references (book chapter:verse). Format the answer in Markdown with clear headings.";

async function ai(system: string, prompt: string, cost: number, maxOutputTokens: number): Promise<Result> {
  const { church } = await requireChurch();
  try {
    const text = await runAi(church, { system: `${PASTOR}\n${system}`, prompt, cost, maxOutputTokens });
    revalidatePath("/", "layout");
    return { text };
  } catch (e) {
    return { error: e instanceof AiError ? e.message : "Something went wrong." };
  }
}

/** Planner tab. "calendar" = one standalone message per Sunday; "series" = one connected series. Costs 2 credits. */
export async function generatePlan(mode: "calendar" | "series", days: number, theme: string) {
  const weeks = Math.max(1, Math.min(12, Math.round(days / 7)));
  const system =
    mode === "series"
      ? `Plan a ${weeks}-week connected sermon series. Give the series title, the big idea, then one section per week with title, key scripture, 3-point outline and application.`
      : `Plan the next ${days} days of preaching as a calendar: one entry per Sunday (${weeks} Sundays) plus a midweek Bible study theme per week. For each: title, key scripture, one-sentence focus.`;
  return ai(system, theme ? `Theme or season to focus on: ${theme}` : "Choose a balanced theme suitable for the season.", 2, 2500);
}

/** Writer tab: full sermon manuscript. Costs 3 credits. */
export async function draftSermon(topic: string, scripture: string) {
  if (!topic.trim()) return { error: "Enter a sermon topic." };
  return ai(
    "Write a complete sermon manuscript: title, scripture reading, introduction with a relatable illustration, 3 main points with supporting scriptures and illustrations, application, a call to response and a closing prayer. About 1,500 words.",
    `Topic: ${topic}\nScripture: ${scripture || "choose the most fitting passage"}`,
    3,
    4000,
  );
}

/** "Draft Summary": short bulletin / SMS-ready summary of the current document. Costs 1 credit. */
export async function summarize(content: string) {
  if (!content.trim()) return { error: "Nothing to summarise yet." };
  return ai(
    "Summarise this sermon for the church bulletin: a 3-sentence summary, the key scripture, and 3 discussion questions for small groups.",
    content,
    1,
    700,
  );
}

export async function saveDraft(input: { id?: string; title: string; kind: string; topic?: string; scripture?: string; content: string }) {
  const { church } = await requireChurch();
  const title = input.title.trim() || input.content.match(/^#+\s*(.+)$/m)?.[1]?.trim() || "Untitled draft";
  if (!input.content.trim()) return { error: "Nothing to save." };
  const kind = ["plan", "sermon", "series"].includes(input.kind) ? input.kind : "sermon";

  let id: string;
  if (input.id) {
    id = input.id;
    await db
      .update(schema.sermon)
      .set({ title, content: input.content, topic: input.topic ?? null, scripture: input.scripture ?? null })
      .where(and(eq(schema.sermon.id, id), eq(schema.sermon.churchId, church.id)));
  } else {
    const [row] = await db
      .insert(schema.sermon)
      .values({ churchId: church.id, title, kind, topic: input.topic ?? null, scripture: input.scripture ?? null, content: input.content })
      .returning({ id: schema.sermon.id });
    id = row.id;
  }
  revalidatePath("/sermon-ai");
  return { id, title };
}

export async function deleteDraft(id: string) {
  const { church } = await requireChurch();
  await db.delete(schema.sermon).where(and(eq(schema.sermon.id, id), eq(schema.sermon.churchId, church.id)));
  revalidatePath("/sermon-ai");
}
