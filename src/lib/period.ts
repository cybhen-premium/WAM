/**
 * Pure period helpers (no db / no "server-only") so the date maths can be
 * shared and verified. Periods are stored in the URL as strings:
 *   "all"      -> lifetime records
 *   "YYYY"     -> a whole year
 *   "YYYY-Q1..Q4" -> a quarter
 *   "YYYY-MM"  -> a month
 */
export type Period = string;

/** UTC-based ISO date (YYYY-MM-DD). Out-of-range month indexes roll over, e.g. month 12 -> next January. */
function iso(y: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(y, monthIndex, day)).toISOString().slice(0, 10);
}

/**
 * Validates a period query value: "YYYY", "YYYY-Q1..Q4" or "YYYY-MM".
 * Falls back to `fallback` (defaults to "all" = lifetime records).
 */
export function parsePeriod(v: unknown, fallback: Period = "all"): Period {
  if (typeof v === "string") {
    if (isValidPeriod(v)) return v;
  }
  return fallback;
}

/** True for "YYYY", "YYYY-Q1..Q4" and "YYYY-MM" (invalid months/quarters are rejected). */
export function isValidPeriod(p: Period): boolean {
  return /^\d{4}$/.test(p) || /^\d{4}-Q[1-4]$/.test(p) || /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

export function periodLabel(p: Period) {
  if (p === "all") return "Lifetime Records";
  if (/^\d{4}$/.test(p)) return p; // "YYYY"
  const quarter = /^(\d{4})-Q([1-4])$/.exec(p);
  if (quarter) return `Q${quarter[2]} ${quarter[1]}`; // "Q1 2026"
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export type PeriodRange = { start: string; end: string };

/**
 * Inclusive start / exclusive end dates for a period, or `null` for lifetime ("all").
 *   "2026"    -> 2026-01-01 .. 2027-01-01
 *   "2026-Q1" -> 2026-01-01 .. 2026-04-01
 *   "2026-Q4" -> 2026-10-01 .. 2027-01-01
 *   "2026-12" -> 2026-12-01 .. 2027-01-01
 */
export function periodRange(p: Period): PeriodRange | null {
  if (/^\d{4}$/.test(p)) {
    const y = Number(p);
    return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
  }

  const quarter = /^(\d{4})-Q([1-4])$/.exec(p);
  if (quarter) {
    const y = Number(quarter[1]);
    const firstMonth = (Number(quarter[2]) - 1) * 3; // 0, 3, 6, 9
    return { start: iso(y, firstMonth, 1), end: iso(y, firstMonth + 3, 1) };
  }

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) {
    const y = Number(p.slice(0, 4));
    const m = Number(p.slice(5, 7)); // 1-based, so it doubles as the exclusive next-month index
    return { start: `${p}-01`, end: iso(y, m, 1) };
  }

  return null; // "all" or anything unrecognised
}
