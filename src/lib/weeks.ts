/**
 * Sundays for the week numbers stored on a tithe. Tithes are collected at Sunday service, so the weeks
 * of a month are its Sundays: week 1 is the first Sunday, week 2 the second, and so on. A tithe only
 * stores that week number (1-5) plus the "YYYY-MM" month it belongs to.
 */
export type MonthWeek = {
  /** 1-5, as stored on the tithe row — week 1 is the first Sunday of the month. */
  week: number;
  /** The Sunday it falls on, e.g. "6 Sep". */
  label: string;
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Validates a "YYYY-MM" month (used before the slice-based maths below). */
function isMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** Days in a "YYYY-MM" month — 28 for February 2026, 29 for February 2024; 0 when the month is invalid. */
export function daysInMonth(month: string): number {
  if (!isMonth(month)) return 0;
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, m, 0)).getUTCDate(); // day 0 of the next month = last day of this one
}

/** The Sundays of a "YYYY-MM" month, week 1 first — four of them, or five when one lands on the 29th or later. */
export function weeksInMonth(month: string): MonthWeek[] {
  const days = daysInMonth(month);
  if (!days) return [];

  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  // 0 = Sunday, so the first Sunday is at most six days after the 1st.
  const firstSunday = 1 + ((7 - new Date(Date.UTC(year, m - 1, 1)).getUTCDay()) % 7);
  const monthName = MONTH_SHORT[m - 1];

  const weeks: MonthWeek[] = [];
  for (let week = 1; week <= 5; week++) {
    const day = firstSunday + (week - 1) * 7;
    if (day > days) break; // this month has no such Sunday
    weeks.push({ week, label: `${day} ${monthName}` });
  }
  return weeks;
}

/**
 * Week columns for one month: the month's Sundays, plus any week a tithe was filed under that the month
 * does not have (a tithe can be saved as "Week 5" even in a month with four Sundays). Weeks saved against
 * a month they do not exist in show no date.
 */
export function weekColumns(month: string, weeksWithData: number[]): { week: number; label: string | null }[] {
  const weeks = weeksInMonth(month);
  const missing = [...new Set(weeksWithData)]
    .filter((week) => week >= 1 && week <= 5 && !weeks.some((w) => w.week === week))
    .sort((a, b) => a - b);

  return [
    ...weeks.map((w) => ({ week: w.week, label: w.label })),
    ...missing.map((week) => ({ week, label: null })),
  ];
}

/**
 * Options for a week picker. Falls back to plain week numbers 1-5 when the month is missing or half
 * typed (an empty `<input type="month">`), so the choices never disappear.
 */
export function weekOptions(month: string): { week: number; label: string | null }[] {
  const weeks = weeksInMonth(month);
  if (weeks.length) return weeks;
  return [1, 2, 3, 4, 5].map((week) => ({ week, label: null }));
}

/**
 * Calculates the exact YYYY-MM-DD date for a given week number (Sunday) in a month.
 * Ensures the date always belongs to that month's billing/reporting cycle.
 */
export function getSundayDate(month: string, week: number): string {
  if (!isMonth(month)) return new Date().toISOString().slice(0, 10);
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const days = daysInMonth(month);
  const firstSunday = 1 + ((7 - new Date(Date.UTC(year, m - 1, 1)).getUTCDay()) % 7);
  const day = Math.min(Math.max(1, firstSunday + (week - 1) * 7), days);
  return `${month}-${String(day).padStart(2, "0")}`;
}
