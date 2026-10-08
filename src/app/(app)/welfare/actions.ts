"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { atRiskWhere } from "@/lib/pastoral";
import { sendSms, withFooter } from "@/lib/sms";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined;

export async function saveAutomation(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("welfare");
  const { church } = await requireChurch();
  const birthday = String(f.get("birthdayTemplate") ?? "").trim();
  const anniversary = String(f.get("anniversaryTemplate") ?? "").trim();
  const absence = String(f.get("absenceTemplate") ?? "").trim();
  if (!birthday || !anniversary) return { error: "Both birthday and anniversary templates are required." };

  await db
    .update(schema.church)
    .set({
      automationEnabled: f.get("enabled") === "on",
      birthdayTemplate: birthday,
      anniversaryTemplate: anniversary,
      ...(absence ? { absenceTemplate: absence } : {}),
    })
    .where(eq(schema.church.id, church.id));
  revalidatePath("/welfare");
  logActivity({
    module: "care",
    action: "Updated member care automation templates",
  });
  return { ok: true, message: "Configuration saved." };
}

/** Lost Sheep → "Schedule Visit": records a pastoral visit. */
export async function scheduleVisit(memberId: string) {
  await requireModule("welfare");
  const { church } = await requireChurch();
  const [m] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(and(eq(schema.member.id, memberId), eq(schema.member.churchId, church.id)))
    .limit(1);
  if (!m) return;
  await db.insert(schema.followUp).values({ churchId: church.id, memberId: m.id, kind: "lost_sheep", stage: "new" });
  revalidatePath("/welfare");

  logActivity({
    module: "care",
    action: "Scheduled pastoral visit for member",
    metadata: { memberId },
  });
}

/** Sends a "we miss you" SMS to the given at-risk members (or all of them when ids is empty). */
export async function reachOut(ids: string[]): Promise<FormState> {
  await requireModule("welfare");
  const { church } = await requireChurch();
  const rows = await db
    .select({ fullName: schema.member.fullName, phone: schema.member.phone })
    .from(schema.member)
    .where(and(atRiskWhere(church), ids.length ? inArray(schema.member.id, ids) : undefined));
  if (rows.length === 0) return { error: "No at-risk members to reach." };

  const body = withFooter(
    church,
    `Hello, we have missed you at ${church.name}! You are always in our prayers and we would love to see you this Sunday.`,
  );
  const r = await sendSms(church, rows.map((m) => m.phone), body, { kind: "reach_out", audience: "At-risk members" });
  revalidatePath("/message-center");
  revalidatePath("/", "layout");
  logActivity({
    module: "care",
    action: `Sent reach-out SMS to ${rows.length} at-risk members`,
    metadata: { count: rows.length, recipients: r.recipients, status: r.status },
  });
  if (r.status === "failed") return { error: r.error };
  return {
    ok: true,
    message: r.status === "queued" ? `Queued for ${r.recipients} (no SMS provider configured yet).` : `Sent to ${r.recipients} members.`,
  };
}

