"use client";

import { useState, useTransition } from "react";
import { UserCheck } from "lucide-react";
import { MEMBER_CATEGORIES } from "@/lib/constants";
import { convertVisitor } from "./actions";

export function ConvertButton({ memberId }: { memberId: string }) {
  const [category, setCategory] = useState("General Member");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
        aria-label="New category"
      >
        {MEMBER_CATEGORIES.filter((c) => c !== "Visitor").map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <button
        disabled={pending}
        onClick={() => startTransition(() => convertVisitor(memberId, category))}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 h-9 text-[11px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        <UserCheck className="h-3.5 w-3.5" /> {pending ? "Converting…" : "Convert"}
      </button>
    </div>
  );
}
