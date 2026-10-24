"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { AiError, runAi } from "@/lib/ai";
import { atRiskWhere } from "@/lib/pastoral";
import { sendSms, withFooter } from "@/lib/sms";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const { member } = schema;

const STYLES = {
  refine: "Rewrite these rough notes into a clear, friendly church announcement.",
  polish: "Polish this announcement: fix grammar, improve flow, keep the meaning.",
  spiritual: "Rewrite this announcement with a warm spiritual tone; a short scripture reference is welcome.",
  shorten: "Shorten this announcement to fit in one SMS (under 160 characters) without losing key details.",
} as const;
export type RefineStyle = keyof typeof STYLES;

/** AI rewrite of the message body. Costs 1 credit. */
export async function refineMessage(style: RefineStyle, topic: string, body: string): Promise<{ text?: string; error?: string }> {
  await requireModule("announcements");
  const { church } = await requireChurch();
  if (!body.trim()) return { error: "Write a few notes first." };
  try {
    const text = await runAi(church, {
      system: `You write SMS announcements for a church. ${STYLES[style] ?? STYLES.refine} Reply with the message text only, no preamble, no quotes. Plain text, no markdown.`,
      prompt: `${topic ? `Topic: ${topic}\n` : ""}Message:\n${body}`,
      cost: 1,
      maxOutputTokens: 400,
    });
    revalidatePath("/", "layout");
    return { text };
  } catch (e) {
    return { error: e instanceof AiError ? e.message : "Something went wrong." };
  }
}

/** Audience values: "all", "at-risk", "dept:<id>", or legacy "category:<name>". */
async function audiencePhones(church: Awaited<ReturnType<typeof requireChurch>>["church"], audience: string) {
  let where;
  if (audience === "at-risk") {
    where = atRiskWhere(church);
  } else if (audience.startsWith("dept:")) {
    where = and(
      eq(member.churchId, church.id),
      eq(member.active, true),
      sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
      eq(member.departmentId, audience.slice(5)),
    );
  } else if (audience.startsWith("category:")) {
    where = and(
      eq(member.churchId, church.id),
      eq(member.active, true),
      sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
      eq(member.category, audience.slice(9)),
    );
  } else {
    // "all" — Entire Congregation (all active members)
    where = and(
      eq(member.churchId, church.id),
      eq(member.active, true),
      sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
    );
  }

  const rows = await db
    .select({ phone: member.phone })
    .from(member)
    .where(and(where, sql`${member.phone} is not null and trim(${member.phone}) != ''`));
  return rows.map((r) => r.phone);
}

export async function sendAnnouncement(topic: string, body: string, audience: string, audienceLabel: string) {
  await requireModule("announcements");
  const { church } = await requireChurch();
  if (!body.trim()) return { error: "Message body is empty." };

  const phones = await audiencePhones(church, audience);
  const r = await sendSms(church, phones, withFooter(church, body.trim()), {
    kind: "broadcast",
    topic: topic.trim() || undefined,
    audience: audienceLabel,
  });
  revalidatePath("/message-center");
  revalidatePath("/", "layout");
  logActivity({
    module: "messaging",
    action: `Sent announcement "${topic.trim() || "Broadcast"}" to ${audienceLabel}`,
    metadata: { topic, audience: audienceLabel, recipients: r.recipients, status: r.status },
  });
  if (r.status === "failed") return { error: r.error ?? "Send failed." };
  return {
    ok: true,
    message:
      r.status === "queued"
        ? `Saved for ${r.recipients} recipients. No SMS provider is configured yet, so nothing was delivered.`
        : `Sent to ${r.recipients} recipients (${r.creditsUsed} credits).`,
  };
}
