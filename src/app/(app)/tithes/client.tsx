"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import { Plus, Wallet, Printer, ChevronDown, Search, X } from "lucide-react";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import Link from "next/link";
import { recordTithe } from "./actions";

/* Header buttons ----------------------------------------------------------- */

export function TithesToolbar({ members, month }: { members: { id: string; name: string }[], month: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full lg:w-auto">
      <Link
        href={`/print/tithes?month=${month}&only=tithers`}
        target="_blank"
        className={buttonStyles.outline}
      >
        <Printer className="h-4 w-4" /> Print Tithers
      </Link>
      
      <button onClick={() => setAdding(true)} className={`${buttonStyles.primary} w-full sm:w-auto bg-green-600 hover:bg-green-700`}>
        <Plus /> Record Tithe
      </button>

      <TitheModal open={adding} onClose={() => setAdding(false)} members={members} month={month} />
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SELECT_CLASS =
  "h-9 sm:h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 cursor-pointer";

/**
 * Ref holding the latest URL query params. A debounced search or a click can fire after the
 * params it captured have changed (e.g. type a name, then jump a month) — writing from the ref
 * keeps the other filters intact instead of restoring stale values.
 */
function useLatestParams() {
  const params = useSearchParams();
  const ref = useRef(params);
  useEffect(() => {
    ref.current = params;
  }, [params]);
  return ref;
}

/* Period selector ---------------------------------------------------------- */

/**
 * Period selector for the summary cards and the tracker list: the year select + month select
 * ("All Months" gives the whole year) pair, driving ?month=YYYY (whole year) or ?month=YYYY-MM.
 */
export function TithePeriodDropdown({ currentPeriod, years }: { currentPeriod: string; years: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLatestParams();

  const selYear = currentPeriod.slice(0, 4);
  const selMonth = currentPeriod.length === 7 ? currentPeriod.slice(5, 7) : "";
  const yearOptions = years.includes(selYear) ? years : [...years, selYear].sort().reverse();

  function setPeriod(value: string) {
    const p = new URLSearchParams(params.current.toString());
    p.set("month", value);
    // Keep the active member search
    const q = params.current.get("q");
    if (q) p.set("q", q);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <select
          value={selYear}
          onChange={(e) => setPeriod(e.target.value)}
          className={SELECT_CLASS}
          aria-label="Filter by year"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
      <div className="relative">
        <select
          value={selMonth}
          onChange={(e) => setPeriod(e.target.value ? `${selYear}-${e.target.value}` : selYear)}
          className={SELECT_CLASS}
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

/* Member search ------------------------------------------------------------ */

/** Debounced member search driving ?q= (the viewed month is preserved). */
export function TitheSearch({ q }: { q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLatestParams();
  const [value, setValue] = useState(q);
  const [, startTransition] = useTransition();

  function apply(next: string) {
    const p = new URLSearchParams(params.current.toString());
    if (next) p.set("q", next);
    else p.delete("q");
    // Keep the viewed period
    const month = params.current.get("month");
    if (month) p.set("month", month);
    startTransition(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  }

  // Wait for typing to settle before hitting the server
  useEffect(() => {
    if (value === q) return;
    const t = setTimeout(() => apply(value.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:flex-1 sm:max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search member…"
        aria-label="Search members"
        className="h-9 sm:h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            apply("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-700"
          aria-label="Clear search"
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function TitheActions({ memberId, memberName, month }: { memberId: string; memberName: string; month?: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="inline-flex items-center gap-1">
      <button 
        onClick={() => setAdding(true)} 
        className="h-8 rounded-lg bg-green-50 px-3 text-[10px] font-black uppercase text-green-600 hover:bg-green-100 transition-colors"
      >
        Record Tithe
      </button>
      <TitheModal open={adding} onClose={() => setAdding(false)} members={[{ id: memberId, name: memberName }]} preselectedMemberId={memberId} month={month} />
    </div>
  );
}

/* Payment form modal ---------------------------------------------------------- */

function TitheModal({ 
  open, 
  onClose, 
  members,
  preselectedMemberId,
  month
}: { 
  open: boolean; 
  onClose: () => void; 
  members: { id: string; name: string }[];
  preselectedMemberId?: string;
  /** Period being viewed ("YYYY-MM" or "YYYY") — pre-fills the month field. */
  month?: string;
}) {
  const [state, action, pending] = useFormAction(recordTithe, onClose);
  
  // Pre-fill the month being viewed, otherwise the current month
  const now = new Date();
  const defaultMonth = month && month.length === 7 ? month : now.toISOString().slice(0, 7);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Tithe"
      subtitle="Weekly Tracking"
      icon={Wallet}
      compact
    >
      <form action={action} className="space-y-5 pb-2 text-left">
        <SelectField 
          label="Member" 
          name="memberId" 
          required 
          options={members.map(m => ({ label: m.name, value: m.id }))}
          defaultValue={preselectedMemberId ?? ""}
        />

        <SelectField 
          label="Which Week?" 
          name="week" 
          required 
          options={[
            { label: "Week 1", value: "1" },
            { label: "Week 2", value: "2" },
            { label: "Week 3", value: "3" },
            { label: "Week 4", value: "4" },
            { label: "Week 5", value: "5" },
          ]}
          defaultValue="1"
        />

        <TextField 
          label="For which month?" 
          name="month" 
          type="month"
          required 
          defaultValue={defaultMonth} 
        />
        
        <TextField 
          label="Amount (GH₵)" 
          name="amount" 
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          required 
          placeholder="0.00" 
        />
        
        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
        
        <button type="submit" disabled={pending} className={cn(buttonStyles.submit, "bg-green-600 hover:bg-green-700")}>
          {pending ? "Saving…" : "Save Tithe"}
        </button>
      </form>
    </Modal>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
