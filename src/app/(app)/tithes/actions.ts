"use server";

import { revalidatePath } from "next/cache";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { TITHE } from "@/lib/constants";

const { tithe, transaction } = schema;

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
  } catch (err: any) {
    if (err?.code === "23505") { // Unique violation
      return { error: "Tithe for this member, week, and month already recorded." };
    }
    return { error: "Failed to record tithe. Please try again." };
  }

  revalidatePath("/tithes");
  revalidatePath("/dashboard");
  return { ok: true };
}
