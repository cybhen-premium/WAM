import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const PLAN_CREDITS: Record<string, number> = { seed: 20, growth: 200, abundance: 300, harvest: 500, enterprise: 2000 };

const money = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 2 });

/** GH₵1,234.5 — amounts come back from Postgres numeric as strings. */
export function cedis(amount: number | string | null | undefined) {
  return `GH₵${money.format(Number(amount ?? 0))}`;
}

export function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso) : iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
