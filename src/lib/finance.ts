import "server-only";
import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";

const { transaction } = schema;

/** "all" or "YYYY-MM". */
export type Period = string;

export function parsePeriod(v: unknown): Period {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? v : "all";
}

export function periodLabel(p: Period) {
  if (p === "all") return "Lifetime Records";
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Current month and the 12 before it, newest first, as options for the period picker. */
export function periodOptions() {
  const now = new Date();
  const opts = [{ value: "all", label: "Lifetime Records" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: periodLabel(value) });
  }
  return opts;
}

/** Filter for transactions in the church and (optionally) the given month. */
export function inPeriod(churchId: string, p: Period): SQL {
  const base = eq(transaction.churchId, churchId);
  if (p === "all") return base;
  const [y, m] = p.split("-").map(Number);
  const start = `${p}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return and(base, gte(transaction.occurredOn, start), lt(transaction.occurredOn, end))!;
}

export const sumAmount = sql<string>`coalesce(sum(${transaction.amount}), 0)`;

export function receiptLabel(n: number | null) {
  return n ? `RCP-${String(n).padStart(5, "0")}` : "—";
}
