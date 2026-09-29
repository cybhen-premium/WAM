"use server";

import { revalidatePath } from "next/cache";
import { sql, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { TITHE } from "@/lib/constants";
import { sendSms, withFooter } from "@/lib/sms";
import { cedis } from "@/lib/utils";

const { tithe, transaction, member } = schema;

/** Visitors and regular attendees are still in the Akwaaba → SOB journey, so they are not members yet. */
const NON_MEMBER_CATEGORIES = ["Visitor", "Regular Attendee"];

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function recordTithe(_prev: FormState, form: FormData): Promise<FormState> {
  const { church } = await requireChurch();
  const memberId = String(form.get("memberId") ?? "");
  const amountStr = String(form.get("amount") ?? "");
  const weekStr = String(form.get("week") ?? "");
  const month = String(form.get("month") ?? "");

  if (!memberId || !amountStr || !weekStr || !month) return { error: "All fields are required." };

  const amount = parseFloat(amountStr);
  const week = parseInt(weekStr, 10);
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number." };
  if (isNaN(week) || week < 1 || week > 5) return { error: "Week must be between 1 and 5." };

  // Tithes are for members only — a visitor / regular attendee isn't a member yet.
  const result = await tithePayer(church.id, memberId);
  if ("error" in result) return { error: result.error };
  const payer = result.payer;

  try {
    await db.insert(tithe).values({
      churchId: church.id,
      memberId,
      amount: amount.toString(),
      week,
      month,
    });

    // Generate receipt number
    const [{ n }] = await db
      .select({ n: sql<number>`coalesce(max(${transaction.receiptNo}), 0) + 1` })
      .from(transaction)
      .where(eq(transaction.churchId, church.id));

    // Also record it in the main ledger for income tracking & receipts
    await db.insert(transaction).values({
      churchId: church.id,
      type: "income",
      category: TITHE,
      amount: amount.toString(),
      memberId,
      receiptNo: Number(n),
      description: `Week ${week}, ${month}`,
      // We set occurredOn to now, which is default
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") { // Unique violation
      return { error: "Tithe for this member, week, and month already recorded." };
    }
    return { error: "Failed to record tithe. Please try again." };
  }

  revalidatePath("/tithes");
  revalidatePath("/dashboard");

  // Automatic thank-you to the payer — same pattern as the welcome SMS: logged in the message log and
  // queued (not sent) when no SMS gateway is configured. Never allowed to fail the tithe itself.
  if (payer.phone) {
    try {
      const first = payer.fullName.split(/\s+/)[0];
      const monthLabel = new Date(month + "-01").toLocaleString("default", { month: "long", year: "numeric" });
      await sendSms(
        church,
        [payer.phone],
        withFooter(church, `Thank you ${first}! We have received your tithe of ${cedis(amount)} for ${monthLabel}. God bless you.`),
        { kind: "tithe", topic: memberId, audience: payer.fullName },
      );
    } catch {
      // Messaging problems must never block recording the tithe.
    }
  }

  return { ok: true };
}

/**
 * Loads the member a tithe is paid by and enforces the members-only rule. Returns `{ payer }` when the
 * member may give tithes, or `{ error }` with the message to show the user.
 */
async function tithePayer(churchId: string, memberId: string) {
  const [payer] = await db
    .select({ category: member.category, fullName: member.fullName, phone: member.phone })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.churchId, churchId)))
    .limit(1);
  if (!payer) return { error: "Member not found." };
  if (NON_MEMBER_CATEGORIES.includes(payer.category)) {
    return { error: "Visitors and regular attendees are not members yet — record their gift as an Offering instead." };
  }
  return { payer };
}

/** "Edit Tithe" in the member list: corrects the member, week, month or amount of an existing tithe. */
export async function updateTithe(_prev: FormState, form: FormData): Promise<FormState> {
  const { church } = await requireChurch();
  const titheId = String(form.get("titheId") ?? "");
  const memberId = String(form.get("memberId") ?? "");
  const amountStr = String(form.get("amount") ?? "");
  const weekStr = String(form.get("week") ?? "");
  const month = String(form.get("month") ?? "");

  if (!titheId || !memberId || !amountStr || !weekStr || !month) return { error: "All fields are required." };

  const amount = parseFloat(amountStr);
  const week = parseInt(weekStr, 10);
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number." };
  if (isNaN(week) || week < 1 || week > 5) return { error: "Week must be between 1 and 5." };

  // The tithe being edited, scoped to this church so a foreign id can never be changed.
  const [existing] = await db
    .select({ memberId: tithe.memberId, week: tithe.week, month: tithe.month })
    .from(tithe)
    .where(and(eq(tithe.id, titheId), eq(tithe.churchId, church.id)))
    .limit(1);
  if (!existing) return { error: "Tithe not found." };

  const payer = await tithePayer(church.id, memberId);
  if ("error" in payer) return { error: payer.error };

  try {
    await db
      .update(tithe)
      .set({ memberId, amount: amount.toString(), week, month })
      .where(and(eq(tithe.id, titheId), eq(tithe.churchId, church.id)));
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") { // Unique violation
      return { error: "Tithe for this member, week, and month already recorded." };
    }
    return { error: "Failed to update tithe. Please try again." };
  }

  // Keep the ledger in sync — recordTithe links the income row by this exact description, so update it
  // in place (its receipt number is kept) when it is still there. Nothing to do when it was deleted.
  try {
    const [ledger] = await db
      .select({ id: transaction.id })
      .from(transaction)
      .where(
        and(
          eq(transaction.churchId, church.id),
          eq(transaction.type, "income"),
          eq(transaction.category, TITHE),
          eq(transaction.memberId, existing.memberId),
          eq(transaction.description, `Week ${existing.week}, ${existing.month}`),
        ),
      )
      .limit(1);
    if (ledger) {
      await db
        .update(transaction)
        .set({ amount: amount.toString(), memberId, description: `Week ${week}, ${month}` })
        .where(eq(transaction.id, ledger.id));
    }
  } catch {
    // Best-effort sync — the tithe itself has already been saved.
  }

  revalidatePath("/tithes");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
  return { ok: true };
}
