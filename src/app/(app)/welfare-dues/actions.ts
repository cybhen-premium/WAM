"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";

const { welfareDues } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function recordDuesPayment(_prev: FormState, form: FormData): Promise<FormState> {
  const { church } = await requireChurch();
  const memberId = String(form.get("memberId") ?? "");
  const amountStr = String(form.get("amount") ?? "");
  const dateStr = String(form.get("date") ?? "");

  if (!memberId || !amountStr || !dateStr) return { error: "All fields are required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number." };

  await db.insert(welfareDues).values({
    churchId: church.id,
    memberId,
    amount: amount.toString(),
    date: dateStr + "T00:00:00.000Z",
  });

  revalidatePath("/welfare-dues");
  revalidatePath("/dashboard");
  return { ok: true };
}
