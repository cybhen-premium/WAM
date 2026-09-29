"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PrintButton } from "../print-button";

const GROUP_OPTIONS = [
  { value: "all", label: "Visitors & Staying" },
  { value: "visiting", label: "Visitors only" },
  { value: "staying", label: "Staying only" },
];

const SELECT =
  "h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-100 cursor-pointer";

/**
 * Hidden when printing: switch the report's month or section in place. The printed page keeps the
 * church header, the counts and both sections (or the single one chosen).
 */
export function AkwaabaPrintControls({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const selected = params.get("month") || month;
  const group = params.get("group") || "all";

  function apply(next: URLSearchParams) {
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="print:hidden mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <input
        type="month"
        value={selected}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("month", e.target.value);
          else next.delete("month");
          apply(next);
        }}
        aria-label="Month to print"
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
      />
      <div className="relative">
        <select
          value={group}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value === "all") next.delete("group");
            else next.set("group", e.target.value);
            apply(next);
          }}
          className={SELECT}
          aria-label="Who to print"
        >
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
      </div>
      <PrintButton />
    </div>
  );
}
