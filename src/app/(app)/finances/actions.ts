"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import {
  TITHE,

  WELFARE_SUPPORT,
} from "@/lib/constants";

const { transaction, projectFund, member } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function amountOf(f: FormData) {
  const n = Number(s(f, "amount"));
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
}

/** Ensures an optional id belongs to this church before we store it. */
async function owned(table: typeof member | typeof projectFund, id: string, churchId: string) {
  if (!id) return null;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.churchId, churchId)))
    .limit(1);
  return row?.id ?? null;
}

async function nextReceiptNo(churchId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(max(${transaction.receiptNo}), 0) + 1` })
    .from(transaction)
    .where(eq(transaction.churchId, churchId));
  return Number(n);
}

function done() {
  revalidatePath("/finances");
  revalidatePath("/giving-analytics");
  return { ok: true } as const;
}

/** "Add Transaction" dialog: general income or expense. */
export async function addTransaction(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("finances");
  const { church } = await requireChurch();
  const type = s(f, "type") === "expense" ? "expense" : "income";
  // The category field is a combo box: the lists are suggestions, so any non-empty value — including a
  // category typed by hand — is valid.
  const category = s(f, "category");
  if (!category) return { error: "Choose or type a category." };
  const amount = amountOf(f);
  if (!amount) return { error: "Enter an amount greater than zero." };

  await db.insert(transaction).values({
    churchId: church.id,
    type,
    category,
    amount,
    occurredOn: isDate(s(f, "date")) ? s(f, "date") : undefined,
    description: s(f, "description") || null,
    memberId: await owned(member, s(f, "memberId"), church.id),
    projectId: category === "Project Fund" ? await owned(projectFund, s(f, "projectId"), church.id) : null,
    receiptNo: type === "income" ? await nextReceiptNo(church.id) : null,
  });
  logActivity({
    module: "finances",
    action: `Recorded ${type} of ₵${amount} (${category})`,
    metadata: { type, category, amount, description: s(f, "description") || null },
  });
  return done();
}

/** Tithes and Welfare Dues tabs: an income tied to a member, with a receipt number. */
export async function recordContribution(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("finances");
  const { church } = await requireChurch();
  if (s(f, "kind") === "dues") return { error: "Welfare dues must be recorded in the Welfare Dues module." };
  const category = TITHE;
  const memberId = await owned(member, s(f, "memberId"), church.id);
  if (!memberId) return { error: "Select a member." };
  const amount = amountOf(f);
  if (!amount) return { error: "Enter an amount greater than zero." };

  await db.insert(transaction).values({
    churchId: church.id,
    type: "income",
    category,
    amount,
    memberId,
    occurredOn: isDate(s(f, "date")) ? s(f, "date") : undefined,
    receiptNo: await nextReceiptNo(church.id),
  });
  logActivity({
    module: "finances",
    action: `Recorded ${category} of ₵${amount}`,
    metadata: { category, amount, memberId },
  });
  return done();
}

/** Welfare Out tab: support paid to a member. */
export async function recordWelfareOut(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("finances");
  const { church } = await requireChurch();
  const memberId = await owned(member, s(f, "memberId"), church.id);
  if (!memberId) return { error: "Select the beneficiary." };
  const amount = amountOf(f);
  if (!amount) return { error: "Enter an amount greater than zero." };

  await db.insert(transaction).values({
    churchId: church.id,
    type: "expense",
    category: WELFARE_SUPPORT,
    amount,
    memberId,
    description: s(f, "description") || null,
    occurredOn: isDate(s(f, "date")) ? s(f, "date") : undefined,
  });
  logActivity({
    module: "finances",
    action: `Recorded welfare support of ₵${amount}`,
    metadata: { amount, memberId },
  });
  revalidatePath("/welfare-dues");
  return done();
}

export async function deleteTransaction(id: string) {
  await requireModule("finances");
  const { church } = await requireChurch();
  await db.delete(transaction).where(and(eq(transaction.id, id), eq(transaction.churchId, church.id)));
  logActivity({
    module: "finances",
    action: "Deleted transaction",
    metadata: { transactionId: id },
  });
  done();
}

export async function saveProject(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("finances");
  const { church } = await requireChurch();
  const name = s(f, "name");
  const target = Number(s(f, "target"));
  if (!name) return { error: "Project name is required." };
  if (!(target > 0)) return { error: "Enter a target amount." };
  await db.insert(projectFund).values({
    churchId: church.id,
    name,
    target: target.toFixed(2),
    dueOn: isDate(s(f, "dueOn")) ? s(f, "dueOn") : null,
  });
  logActivity({
    module: "finances",
    action: `Created project fund "${name}"`,
    metadata: { name, target },
  });
  return done();
}

export async function deleteProject(id: string) {
  await requireModule("finances");
  const { church } = await requireChurch();
  await db.delete(projectFund).where(and(eq(projectFund.id, id), eq(projectFund.churchId, church.id)));
  logActivity({
    module: "finances",
    action: "Deleted project fund",
    metadata: { projectId: id },
  });
  done();
}
