"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Year + month dropdown combo driving ?period=YYYY or ?period=YYYY-MM. */
export function HistoryFilters({ years, selection }: { years: string[]; selection: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selYear = selection.slice(0, 4);
  const selMonth = selection.length === 7 ? selection.slice(5, 7) : "";

  function setPeriod(value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("period", value);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <select
          value={selYear}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 cursor-pointer"
          aria-label="Filter by year"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
      <div className="relative">
        <select
          value={selMonth}
          onChange={(e) => setPeriod(e.target.value ? `${selYear}-${e.target.value}` : selYear)}
          className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 cursor-pointer"
          aria-label="Filter by month"
        >
          <option value="">All Months</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}
