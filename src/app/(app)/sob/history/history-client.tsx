"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type HistoryRow = {
  memberId: string;
  completedAt: string | null;
  fullName: string;
  phone: string | null;
  category: string;
};

/**
 * The baptism log. Hiding a row only takes it out of *this view* — the record stays in the database
 * (nothing is deleted, nobody is un-baptised), which is what an accountability log needs.
 */
export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = rows.filter((r) => !hidden.includes(r.memberId));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {["Name", "Category", "Contact", "Baptism Date"].map((h) => (
                <th key={h} className="px-4 h-14 text-left align-middle font-black text-[10px] uppercase tracking-widest text-slate-400">
                  {h}
                </th>
              ))}
              <th className="px-4 pr-8 h-14 text-right align-middle font-black text-[10px] uppercase tracking-widest text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.memberId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 pl-8 py-3">
                  <p className="font-bold text-slate-900">{r.fullName}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tight", "bg-slate-100 text-slate-600")}>
                    {r.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 font-semibold">{r.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600 font-semibold">
                  {r.completedAt
                    ? new Date(r.completedAt + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </td>
                <td className="px-4 pr-8 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setHidden((h) => [...h, r.memberId])}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Hide from this list"
                    aria-label={`Hide ${r.fullName} from this list`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {hidden.length} hidden from this list · the records are kept in the database
          </p>
          <button
            type="button"
            onClick={() => setHidden([])}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Show hidden
          </button>
        </div>
      )}
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

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
