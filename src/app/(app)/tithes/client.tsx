"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import { Plus, Wallet, Printer, ChevronDown, Search, X, Pencil } from "lucide-react";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import { weekOptions } from "@/lib/weeks";
import { cedis } from "@/lib/utils";
import Link from "next/link";
import { recordTithe, updateTithe } from "./actions";

/* Header buttons ----------------------------------------------------------- */

export function TithesToolbar({
  members,
  month,
  period,
}: {
  members: { id: string; name: string }[];
  /** Month the Record Tithe form pre-fills ("YYYY-MM"; a year falls back to the current month). */
  month: string;
  /** Card combo box period ("YYYY" or "YYYY-MM") — what "Print Tithers" prints. */
  period: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full lg:w-auto">
      <Link
        href={`/print/tithes?month=${period}&only=tithers`}
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
 * The tracker's period selector: the year select + month select pair ("All Months" gives the whole
 * year). One selector drives the whole page — the summary cards, the member list and the print report.
 */
export function TithePeriodDropdown({
  currentPeriod,
  years,
}: {
  currentPeriod: string;
  years: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLatestParams();

  const selYear = currentPeriod.slice(0, 4);
  const selMonth = currentPeriod.length === 7 ? currentPeriod.slice(5, 7) : "";
  const yearOptions = years.includes(selYear) ? years : [...years, selYear].sort().reverse();

  // Only the period changes — the member search and any other param are copied across untouched.
  function setPeriod(value: string) {
    const p = new URLSearchParams(params.current.toString());
    p.set("month", value);
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

export function TitheActions({
  memberId,
  memberName,
  month,
  members,
  tithes = [],
}: {
  memberId: string;
  memberName: string;
  month?: string;
  /** All members — the edit form can move a tithe to the right member. */
  members?: { id: string; name: string }[];
  /** This member's tithes in the viewed month (oldest week first) — what the Edit button opens. */
  tithes?: TitheEntry[];
}) {
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<TitheEntry | null>(null);

  const memberList = members ?? [{ id: memberId, name: memberName }];

  // A single tithe opens the form straight away; a row with several weeks asks which one first.
  function beginEdit() {
    if (tithes.length === 1) setPicked(tithes[0]);
    else setChoosing(true);
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button 
        onClick={() => setAdding(true)} 
        className="h-8 rounded-lg bg-green-50 px-3 text-[10px] font-black uppercase text-green-600 hover:bg-green-100 transition-colors"
      >
        Record Tithe
      </button>
      {tithes.length > 0 && (
        <button onClick={beginEdit} className={buttonStyles.ghost} title="Edit" aria-label="Edit">
          <Pencil />
        </button>
      )}

      <TitheModal open={adding} onClose={() => setAdding(false)} members={memberList} preselectedMemberId={memberId} month={month} />
      <TithePickModal
        open={choosing}
        onClose={() => setChoosing(false)}
        tithes={tithes}
        onPick={(t) => {
          setChoosing(false);
          setPicked(t);
        }}
      />
      <TitheEditModal
        open={picked !== null}
        onClose={() => setPicked(null)}
        tithe={picked ? { ...picked, memberId } : { id: "", memberId, week: 1, month: month ?? "", amount: "" }}
        members={memberList}
      />
    </div>
  );
}

/* Payment form modal ---------------------------------------------------------- */

/**
 * Month + week for a tithe. Every week option carries the Sunday that week falls on in the chosen month
 * ("Week 2 · 13 Sep"), so the choice is unambiguous; editing the month updates the dates. Mounted only
 * while the modal is open, so both fields reset to the pre-filled values each time it opens.
 * `defaultWeek` pre-selects the week being edited and stays among the options even when the month has
 * no such Sunday (a tithe filed as "Week 5" in a month with four Sundays).
 */
function WeekFields({ defaultMonth, defaultWeek }: { defaultMonth: string; defaultWeek?: number }) {
  const [month, setMonth] = useState(defaultMonth);

  const weeks = weekOptions(month);
  const options = (
    defaultWeek && !weeks.some((w) => w.week === defaultWeek)
      ? [...weeks, { week: defaultWeek, label: null }]
      : weeks
  ).map((w) => ({
    label: w.label ? `Week ${w.week} · ${w.label}` : `Week ${w.week}`,
    value: String(w.week),
  }));

  return (
    <>
      <SelectField
        label="Which Week?"
        name="week"
        required
        options={options}
        defaultValue={String(defaultWeek ?? 1)}
      />

      <TextField
        label="For which month?"
        name="month"
        type="month"
        required
        value={month}
        onChange={(e) => setMonth(e.target.value)}
      />
    </>
  );
}

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

        <WeekFields defaultMonth={defaultMonth} />
        
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

/* Edit an existing tithe -------------------------------------------------- */

/** A recorded tithe as it appears in the list — one per member / week / month. */
type TitheEntry = { id: string; week: number; month: string; amount: string };

/**
 * Step between the list's Edit button and the form when a member gave in several weeks of the month:
 * choose which tithe to edit — each option shows the Sunday that week falls on and the amount given.
 */
function TithePickModal({
  open,
  onClose,
  tithes,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  tithes: TitheEntry[];
  onPick: (tithe: TitheEntry) => void;
}) {
  const sundays = new Map(weekOptions(tithes[0]?.month ?? "").map((w) => [w.week, w.label]));

  return (
    <Modal open={open} onClose={onClose} title="Edit Tithe" subtitle="Which week's tithe?" icon={Pencil} compact>
      <div className="space-y-2 pb-2">
        {tithes.map((t) => {
          const sunday = sundays.get(t.week);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-green-500 hover:bg-green-50"
            >
              <span className="text-sm font-bold text-slate-700">
                Week {t.week}
                {sunday && <span className="ml-1 text-xs font-semibold text-slate-400">· {sunday}</span>}
              </span>
              <span className="text-sm font-black text-emerald-600">{cedis(t.amount)}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/**
 * Edit one recorded tithe — the same fields as the record modal, pre-filled from the row, plus the
 * tithe id. Saved by `updateTithe`, which also keeps the linked ledger income in sync.
 */
function TitheEditModal({
  open,
  onClose,
  tithe,
  members,
}: {
  open: boolean;
  onClose: () => void;
  tithe: { id: string; memberId: string; week: number; month: string; amount: string };
  members: { id: string; name: string }[];
}) {
  const [state, action, pending] = useFormAction(updateTithe, onClose);

  return (
    <Modal open={open} onClose={onClose} title="Edit Tithe" subtitle="Weekly Tracking" icon={Pencil} compact>
      <form action={action} className="space-y-5 pb-2 text-left">
        <input type="hidden" name="titheId" value={tithe.id} readOnly />

        <SelectField
          label="Member"
          name="memberId"
          required
          options={members.map((m) => ({ label: m.name, value: m.id }))}
          defaultValue={tithe.memberId}
        />

        <WeekFields defaultMonth={tithe.month} defaultWeek={tithe.week} />

        <TextField
          label="Amount (GH₵)"
          name="amount"
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          required
          defaultValue={tithe.amount}
        />

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className={cn(buttonStyles.submit, "bg-green-600 hover:bg-green-700")}>
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </Modal>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
