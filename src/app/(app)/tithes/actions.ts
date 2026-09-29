"use server";

import { revalidatePath } from "next/cache";
import { sql, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { TITHE } from "@/lib/constants";

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
  const [payer] = await db
    .select({ category: member.category })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.churchId, church.id)))
    .limit(1);
  if (!payer) return { error: "Member not found." };
  if (NON_MEMBER_CATEGORIES.includes(payer.category)) {
    return { error: "Visitors and regular attendees are not members yet — record their gift as an Offering instead." };
  }

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
  return { ok: true };
}
