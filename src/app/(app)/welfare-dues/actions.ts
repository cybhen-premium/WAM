"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { WELFARE_MONTHLY_TARGET } from "@/lib/constants";

const { welfareDues, member } = schema;

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
    .select({ category: member.category, fullName: member.fullName })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);
  if (!memberRow) return { error: "Member not found." };
  if (NON_MEMBER_CATEGORIES.includes(memberRow.category)) {
    return { error: "Welfare dues can only be recorded for full church members, not Visitors or Regular Attendees." };
  }

  // Enforce monthly expected dues cap (cannot exceed target within the month)
  const month = dateStr.slice(0, 7);
  const monthFilter = month + "%";

  const monthlyTarget = parseFloat(church.welfareMonthlyTarget ?? "20.00") || WELFARE_MONTHLY_TARGET;

  const [alreadyPaidRow] = await db
    .select({ total: sql<string>`coalesce(sum(${welfareDues.amount}), 0)` })
    .from(welfareDues)
    .where(
      and(
        eq(welfareDues.churchId, church.id),
        eq(welfareDues.memberId, memberId),
        sql`cast(${welfareDues.date} as text) like ${monthFilter}`,
      ),
    );

  const alreadyPaid = parseFloat(alreadyPaidRow?.total ?? "0");
  const maxAllowed = Math.max(0, monthlyTarget - alreadyPaid);

  const monthLabel = new Date(dateStr + "T00:00:00Z").toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  if (alreadyPaid >= monthlyTarget) {
    return {
      error: `${memberRow.fullName} has already paid the full expected dues of GH₵ ${monthlyTarget.toFixed(2)} for ${monthLabel}.`,
    };
  }

  if (amount > maxAllowed) {
    return {
      error: `Payment exceeds the expected monthly amount of GH₵ ${monthlyTarget.toFixed(2)}. ${memberRow.fullName} has already paid GH₵ ${alreadyPaid.toFixed(2)} for ${monthLabel}. Maximum allowed is GH₵ ${maxAllowed.toFixed(2)}.`,
    };
  }

  await db.insert(welfareDues).values({
    churchId: church.id,
    memberId,
    amount: amount.toString(),
    date: dateStr + "T00:00:00.000Z",
  });

  const m = memberRow;

  logActivity({
    module: "welfare",
    actionCode: "welfare.dues",
    action: `Recorded welfare dues payment of ₵${amount.toFixed(2)} for ${m?.fullName || "member"}`,
    metadata: { memberId, memberName: m?.fullName, amount, date: dateStr },
  });

  revalidatePath("/welfare-dues");
  revalidatePath("/dashboard");
  revalidatePath("/finances");
  return { ok: true };
}

export async function updateDuesPayment(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("care");
  const { church } = await requireChurch();
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
    .where(and(eq(welfareDues.id, duesId), eq(welfareDues.churchId, church.id)))
    .limit(1);
  if (!row) return { error: "Payment record not found." };

  // Enforce monthly expected dues cap (cannot exceed target within the month)
  const month = dateStr.slice(0, 7);
  const monthFilter = month + "%";

  const monthlyTarget = parseFloat(church.welfareMonthlyTarget ?? "20.00") || WELFARE_MONTHLY_TARGET;

  const [otherPaidRow] = await db
    .select({ total: sql<string>`coalesce(sum(${welfareDues.amount}), 0)` })
    .from(welfareDues)
    .where(
      and(
        eq(welfareDues.churchId, church.id),
        eq(welfareDues.memberId, row.memberId),
        ne(welfareDues.id, duesId),
        sql`cast(${welfareDues.date} as text) like ${monthFilter}`,
      ),
    );

  const otherPaid = parseFloat(otherPaidRow?.total ?? "0");
  const maxAllowed = Math.max(0, monthlyTarget - otherPaid);

  const monthLabel = new Date(dateStr + "T00:00:00Z").toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  if (amount > maxAllowed) {
    if (otherPaid > 0) {
      return {
        error: `Cannot exceed expected monthly dues of GH₵ ${monthlyTarget.toFixed(2)}. Other payments in ${monthLabel}: GH₵ ${otherPaid.toFixed(2)}. Maximum allowed for this record is GH₵ ${maxAllowed.toFixed(2)}.`,
      };
    } else {
      return {
        error: `Cannot exceed expected monthly dues of GH₵ ${monthlyTarget.toFixed(2)} for ${monthLabel}.`,
      };
    }
  }

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

export async function updateWelfareTarget(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("care");
  const { church } = await requireChurch();
  const targetStr = String(form.get("target") ?? "");
  const target = parseFloat(targetStr);

  if (isNaN(target) || target <= 0) {
    return { error: "Please enter a valid amount greater than zero." };
  }

  await db
    .update(schema.church)
    .set({ welfareMonthlyTarget: target.toFixed(2) })
    .where(eq(schema.church.id, church.id));

  logActivity({
    module: "welfare",
    actionCode: "welfare.target.update",
    action: `Updated monthly welfare dues target to ₵${target.toFixed(2)}`,
    metadata: { target },
  });

  revalidatePath("/welfare-dues");
  revalidatePath("/settings");
  return { ok: true };
}
