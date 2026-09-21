"use client";

import { ChevronDown, Filter } from "lucide-react";
import { useSetUrlParam } from "@/components/use-url-param";

export function PeriodSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const [setParam] = useSetUrlParam();
  return (
    <div className="relative flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm">
      <Filter className="ml-2 h-4 w-4 text-slate-400" />
      <select
        value={value}
        onChange={(e) => setParam("range", e.target.value === "all" ? "" : e.target.value)}
        className="h-9 w-40 appearance-none rounded-xl bg-slate-50 pl-3 pr-8 text-[11px] font-black uppercase outline-none"
        aria-label="Period"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 opacity-50" />
    </div>
  );
}
