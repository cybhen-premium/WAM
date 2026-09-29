import "server-only";
import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { periodRange, type Period } from "./period";

const { transaction } = schema;

export { isValidPeriod, parsePeriod, periodLabel, periodRange, type Period, type PeriodRange } from "./period";

/** Filter for transactions in the church and (optionally) the given period. */
export function inPeriod(churchId: string, p: Period): SQL {
  const base = eq(transaction.churchId, churchId);
  const range = periodRange(p);
  if (!range) return base; // lifetime

  return and(base, gte(transaction.occurredOn, range.start), lt(transaction.occurredOn, range.end))!;
}

export const sumAmount = sql<string>`coalesce(sum(${transaction.amount}), 0)`;

export function receiptLabel(n: number | null) {
  return n ? `RCP-${String(n).padStart(5, "0")}` : "—";
}
