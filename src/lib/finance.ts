import "server-only";
import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";

const { transaction } = schema;

/** "all" or "YYYY-MM". */
export type Period = string;

export function parsePeriod(v: unknown): Period {
  if (typeof v !== "string") return "all";
  if (/^\d{4}$/.test(v)) return v; // Yearly
  if (/^\d{4}-Q[1-4]$/.test(v)) return v; // Quarterly
  if (/^\d{4}-\d{2}$/.test(v)) return v; // Monthly
  return "all";
}

export function periodLabel(p: Period) {
  if (p === "all") return "Lifetime Records";
  if (p.length === 4) return p; // "YYYY"
  if (p.includes("-Q")) {
    const [y, q] = p.split("-");
    return `${q} ${y}`; // "Q1 2026"
  }
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Current month/quarter/year and the previous ones as options for the period picker. */
export function periodOptions() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const currentQ = Math.floor(m / 3) + 1;

  const opts = [];
  opts.push({ group: "All Time", options: [{ value: "all", label: "Lifetime Records" }] });
  
  // Years (Current and last 2)
  const years = [];
  for (let i = 0; i < 3; i++) {
    years.push({ value: `${y - i}`, label: `${y - i}` });
  }
  opts.push({ group: "Years", options: years });

  // Quarters (Current and last 3)
  const quarters = [];
  for (let i = 0; i < 4; i++) {
    let q = currentQ - i;
    let qY = y;
    if (q < 1) {
      q += 4;
      qY -= 1;
    }
    const value = `${qY}-Q${q}`;
    quarters.push({ value, label: periodLabel(value) });
  }
  opts.push({ group: "Quarters", options: quarters });

  // Months (Current and last 11)
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ value, label: periodLabel(value) });
  }
  opts.push({ group: "Months", options: months });

  return opts;
}

/** Filter for transactions in the church and (optionally) the given period. */
export function inPeriod(churchId: string, p: Period): SQL {
  const base = eq(transaction.churchId, churchId);
  if (p === "all") return base;

  let start: string;
  let end: string;

  if (p.length === 4) {
    const y = Number(p);
    start = `${y}-01-01`;
    end = new Date(Date.UTC(y + 1, 0, 1)).toISOString().slice(0, 10);
  } else if (p.includes("-Q")) {
    const [yStr, qStr] = p.split("-Q");
    const y = Number(yStr);
    const q = Number(qStr);
    const startMonth = (q - 1) * 3;
    start = new Date(Date.UTC(y, startMonth, 1)).toISOString().slice(0, 10);
    end = new Date(Date.UTC(y, startMonth + 3, 1)).toISOString().slice(0, 10);
  } else {
    const [y, m] = p.split("-").map(Number);
    start = `${p}-01`;
    end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }

  return and(base, gte(transaction.occurredOn, start), lt(transaction.occurredOn, end))!;
}

export const sumAmount = sql<string>`coalesce(sum(${transaction.amount}), 0)`;

export function receiptLabel(n: number | null) {
  return n ? `RCP-${String(n).padStart(5, "0")}` : "—";
}
