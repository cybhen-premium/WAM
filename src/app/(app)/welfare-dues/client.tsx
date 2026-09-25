"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import { Plus, HeartHandshake, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import { recordDuesPayment } from "./actions";

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

export function PeriodSelector({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = [];
  const now = new Date();
  options.push({ value: now.getFullYear().toString(), label: `Full Year ${now.getFullYear()}` });
  options.push({ value: (now.getFullYear() - 1).toString(), label: `Full Year ${now.getFullYear() - 1}` });
  
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
         p.set("period", e.target.value);
         router.push(`${pathname}?${p.toString()}`);
      }}
      className="h-9 sm:h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
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
