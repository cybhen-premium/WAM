"use server";

import { revalidatePath } from "next/cache";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { WELFARE_DUES } from "@/lib/constants";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const { welfareDues, transaction, member } = schema;

// Visitors and Regular Attendees are not full church members — block welfare dues for them
const NON_MEMBER_CATEGORIES = ["Visitor", "Regular Attendee"];

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function recordDuesPayment(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("care");
  const { church } = await requireChurch();
  const memberId = String(form.get("memberId") ?? "");
  const amountStr = String(form.get("amount") ?? "");
  const dateStr = String(form.get("date") ?? "");

  if (!memberId || !amountStr || !dateStr) return { error: "All fields are required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number." };

  // Verify the member is a full church member (not a Visitor or Regular Attendee)
  const [memberRow] = await db
    .select({ category: member.category })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);
  if (!memberRow) return { error: "Member not found." };
  if (NON_MEMBER_CATEGORIES.includes(memberRow.category)) {
    return { error: "Welfare dues can only be recorded for full church members, not Visitors or Regular Attendees." };
  }

  await db.insert(welfareDues).values({
    churchId: church.id,
    memberId,
    amount: amount.toString(),
    date: dateStr + "T00:00:00.000Z",
  });

  // Generate receipt number
  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(max(${transaction.receiptNo}), 0) + 1` })
    .from(transaction)
    .where(eq(transaction.churchId, church.id));

  // Record it in the main ledger for income tracking & receipts
  await db.insert(transaction).values({
    churchId: church.id,
    type: "income",
    category: WELFARE_DUES,
    amount: amount.toString(),
    memberId,
    receiptNo: Number(n),
    occurredOn: dateStr,
  });

  const [m] = await db
    .select({ fullName: member.fullName })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);

  logActivity({
    module: "welfare",
    actionCode: "welfare.dues",
    action: `Recorded welfare dues payment of ₵${amount.toFixed(2)} for ${m?.fullName || "member"}`,
    metadata: { memberId, memberName: m?.fullName, amount, date: dateStr, receiptNo: Number(n) },
  });

  revalidatePath("/welfare-dues");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateDuesPayment(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("care");
  const duesId = String(form.get("duesId") ?? "");
  const amountStr = String(form.get("amount") ?? "");
  const dateStr = String(form.get("date") ?? "");

  if (!duesId || !amountStr || !dateStr) return { error: "All fields are required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number." };

  // Verify the dues row exists
  const [row] = await db
    .select({ id: welfareDues.id, memberId: welfareDues.memberId })
    .from(welfareDues)
    .where(eq(welfareDues.id, duesId))
    .limit(1);
  if (!row) return { error: "Payment record not found." };

  await db
    .update(welfareDues)
    .set({ amount: amount.toString(), date: dateStr + "T00:00:00.000Z" })
    .where(eq(welfareDues.id, duesId));

  const [m] = await db
    .select({ fullName: member.fullName })
    .from(member)
    .where(eq(member.id, row.memberId))
    .limit(1);

  logActivity({
    module: "welfare",
    actionCode: "welfare.dues.edit",
    action: `Updated welfare dues payment to ₵${amount.toFixed(2)} for ${m?.fullName || "member"}`,
    metadata: { duesId, memberId: row.memberId, memberName: m?.fullName, amount, date: dateStr },
  });

  revalidatePath("/welfare-dues");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteDuesPayment(duesId: string): Promise<void> {
  await requireModule("care");

  const [row] = await db
    .select({ id: welfareDues.id, memberId: welfareDues.memberId, amount: welfareDues.amount })
    .from(welfareDues)
    .where(eq(welfareDues.id, duesId))
    .limit(1);
  if (!row) return;

  await db.delete(welfareDues).where(eq(welfareDues.id, duesId));

  const [m] = await db
    .select({ fullName: member.fullName })
    .from(member)
    .where(eq(member.id, row.memberId))
    .limit(1);

  logActivity({
    module: "welfare",
    actionCode: "welfare.dues.delete",
    action: `Deleted welfare dues payment of ₵${Number(row.amount).toFixed(2)} for ${m?.fullName || "member"}`,
    metadata: { duesId, memberId: row.memberId, memberName: m?.fullName, amount: row.amount },
  });

  revalidatePath("/welfare-dues");
  revalidatePath("/dashboard");
}
