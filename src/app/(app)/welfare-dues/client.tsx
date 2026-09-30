"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import { Plus, ChevronDown, HeartHandshake, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import { recordDuesPayment } from "./actions";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* Header buttons ----------------------------------------------------------- */

export function WelfareDuesToolbar({ members }: { members: { id: string; name: string }[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full lg:w-auto">
      <button onClick={() => setAdding(true)} className={`${buttonStyles.primary} w-full sm:w-auto`}>
        <Plus /> Record Payment
      </button>

      <PaymentModal open={adding} onClose={() => setAdding(false)} members={members} />
    </div>
  );
}

/**
 * The same year + month combo box used on the Akwaaba, Tithes and SOB pages: the year select plus
 * "All Months" (which means the whole year). Drives ?period= on this page.
 */
export function PeriodSelector({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const selYear = current.slice(0, 4);
  const selMonth = current.length === 7 ? current.slice(5, 7) : "";

  const thisYear = new Date().getFullYear();
  const years = [String(thisYear), String(thisYear - 1), String(thisYear - 2)];
  const yearOptions = years.includes(selYear) ? years : [...years, selYear].sort().reverse();

  function setPeriod(value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("period", value);
    startTransition(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  }

  const select =
    "h-9 sm:h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer";

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <select
          value={selYear}
          onChange={(e) => setPeriod(e.target.value)}
          className={select}
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
          className={select}
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

export function StatusBadge({ paid, target }: { paid: number, target: number }) {
  const isPaid = paid >= target;
  
  if (isPaid) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Fully Paid
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
      <AlertCircle className="h-3 w-3" /> Arrears
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function DuesActions({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="inline-flex items-center gap-1">
      <button 
        onClick={() => setAdding(true)} 
        className="h-8 rounded-lg bg-emerald-50 px-3 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-100 transition-colors"
      >
        Record Payment
      </button>
      <PaymentModal open={adding} onClose={() => setAdding(false)} members={[{ id: memberId, name: memberName }]} preselectedMemberId={memberId} />
    </div>
  );
}

/* Payment form modal ---------------------------------------------------------- */

function PaymentModal({ 
  open, 
  onClose, 
  members,
  preselectedMemberId
}: { 
  open: boolean; 
  onClose: () => void; 
  members: { id: string; name: string }[];
  preselectedMemberId?: string;
}) {
  const [state, action, pending] = useFormAction(recordDuesPayment, onClose);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Welfare Dues"
      subtitle="Contributions"
      icon={HeartHandshake}
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
        
        <TextField 
          label="Amount (GH₵)" 
          name="amount" 
          type="number"
          step="0.01"
          required 
          placeholder="e.g. 20.00 or 5.00" 
          defaultValue="20" 
        />

        <TextField 
          label="Date of Payment" 
          name="date" 
          type="date"
          required 
          defaultValue={today} 
        />
        
        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
        
        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Saving…" : "Save Payment"}
        </button>
      </form>
    </Modal>
  );
}
