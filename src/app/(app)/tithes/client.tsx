"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import { Plus, Wallet, CheckCircle2, Printer } from "lucide-react";
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

      <TitheModal open={adding} onClose={() => setAdding(false)} members={members} />
    </div>
  );
}

export function MonthSelector({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    options.push({ value: val, label });
  }

  return (
    <select 
      value={current} 
      onChange={(e) => {
         const p = new URLSearchParams(searchParams.toString());
         p.set("month", e.target.value);
         router.push(`${pathname}?${p.toString()}`);
      }}
      className="h-9 sm:h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 cursor-pointer"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/* Per-row actions ---------------------------------------------------------- */

export function TitheActions({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="inline-flex items-center gap-1">
      <button 
        onClick={() => setAdding(true)} 
        className="h-8 rounded-lg bg-green-50 px-3 text-[10px] font-black uppercase text-green-600 hover:bg-green-100 transition-colors"
      >
        Record Tithe
      </button>
      <TitheModal open={adding} onClose={() => setAdding(false)} members={[{ id: memberId, name: memberName }]} preselectedMemberId={memberId} />
    </div>
  );
}

/* Payment form modal ---------------------------------------------------------- */

function TitheModal({ 
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
  const [state, action, pending] = useFormAction(recordTithe, onClose);
  
  // Default to current month
  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);

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
