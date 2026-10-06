"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import { Plus, ChevronDown, HeartHandshake, CheckCircle2, AlertCircle, Pencil, Trash2, Coins, Sliders } from "lucide-react";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { recordDuesPayment, updateDuesPayment, deleteDuesPayment, updateWelfareTarget } from "./actions";
import { WELFARE_MONTHLY_TARGET } from "@/lib/constants";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* Header buttons ----------------------------------------------------------- */

export function WelfareDuesToolbar({
  members,
  target = 20,
}: {
  members: { id: string; name: string }[];
  target?: number;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full lg:w-auto">
      <button onClick={() => setAdding(true)} className={`${buttonStyles.primary} w-full sm:w-auto`}>
        <Plus /> Record Payment
      </button>

      <PaymentModal open={adding} onClose={() => setAdding(false)} members={members} target={target} />
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

type DuesEntry = { id: string; amount: string; date: string };

export function DuesActions({
  memberId,
  memberName,
  isPaid,
  dues,
  target = 20,
}: {
  memberId: string;
  memberName: string;
  isPaid: boolean;
  dues: DuesEntry[];
  target?: number;
}) {
  const [adding, setAdding] = useState(false);
  const [editingDue, setEditingDue] = useState<DuesEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-1 flex-wrap justify-end">
      {/* If fully paid, show a "Paid" chip instead of the Record button */}
      {isPaid ? (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> Paid
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="h-8 rounded-lg bg-emerald-50 px-3 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-100 transition-colors"
        >
          Record Payment
        </button>
      )}

      {/* Edit button — only shown if there are dues records */}
      {dues.length > 0 && (
        <button
          onClick={() => setEditingDue(dues[0])}
          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          title="Edit latest payment"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Delete button — only shown if there are dues records */}
      {dues.length > 0 && (
        <button
          onClick={() => setDeletingId(dues[0].id)}
          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Delete latest payment"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Add payment modal */}
      <PaymentModal
        open={adding}
        onClose={() => setAdding(false)}
        members={[{ id: memberId, name: memberName }]}
        preselectedMemberId={memberId}
        target={target}
      />

      {/* Edit payment modal */}
      {editingDue && (
        <EditPaymentModal
          open={!!editingDue}
          onClose={() => setEditingDue(null)}
          due={editingDue}
          target={target}
        />
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete Payment"
        description="Are you sure you want to delete this welfare dues payment? This action cannot be undone."
        confirmLabel="Delete"
        successMessage="Payment deleted."
        errorMessage="Failed to delete payment."
        onConfirm={async () => {
          await deleteDuesPayment(deletingId!);
        }}
      />
    </div>
  );
}

/* Payment form modal (add new) ---------------------------------------------------------- */

function PaymentModal({ 
  open, 
  onClose, 
  members,
  preselectedMemberId,
  target = 20,
}: { 
  open: boolean; 
  onClose: () => void; 
  members: { id: string; name: string }[];
  preselectedMemberId?: string;
  target?: number;
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
        
        <div>
          <TextField 
            label="Amount (GH₵)" 
            name="amount" 
            type="number"
            step="0.01"
            min="0.01"
            max={target}
            required 
            placeholder={`e.g. ${target}.00`} 
            defaultValue={String(target)} 
          />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mt-1.5">
            Max expected: GH₵ {target.toFixed(2)} / month
          </p>
        </div>

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

/* Edit payment modal ---------------------------------------------------------- */

function EditPaymentModal({
  open,
  onClose,
  due,
  target = 20,
}: {
  open: boolean;
  onClose: () => void;
  due: DuesEntry;
  target?: number;
}) {
  const [state, action, pending] = useFormAction(updateDuesPayment, onClose);
  // date comes as ISO string like "2026-09-01T00:00:00.000Z" — slice to YYYY-MM-DD
  const dateValue = due.date ? due.date.slice(0, 10) : new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Welfare Dues"
      subtitle="Update Payment"
      icon={HeartHandshake}
      compact
    >
      <form action={action} className="space-y-5 pb-2 text-left">
        {/* Hidden field to identify the dues record */}
        <input type="hidden" name="duesId" value={due.id} />

        <div>
          <TextField
            label="Amount (GH₵)"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={target}
            required
            placeholder={`e.g. ${target}.00`}
            defaultValue={due.amount}
          />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mt-1.5">
            Max expected: GH₵ {target.toFixed(2)} / month
          </p>
        </div>

        <TextField
          label="Date of Payment"
          name="date"
          type="date"
          required
          defaultValue={dateValue}
        />

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Saving…" : "Update Payment"}
        </button>
      </form>
    </Modal>
  );
}

/* Dues Target Configuration Section ----------------------------------------- */

export function DuesTargetSection({ currentTarget }: { currentTarget: number }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:border-slate-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Monthly Dues Target</h3>
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-black text-blue-700">
                GH₵ {currentTarget.toFixed(2)} / month
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Each active member is expected to contribute GH₵ {currentTarget.toFixed(2)} monthly (GH₵ {(currentTarget * 12).toFixed(2)}/year). Payments within a month cannot exceed this amount.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 px-4 h-10 text-xs font-black text-slate-700 transition-colors shrink-0 shadow-sm cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5 text-slate-500" /> Edit Expected Amount
        </button>
      </div>

      <EditTargetModal
        open={editing}
        onClose={() => setEditing(false)}
        currentTarget={currentTarget}
      />
    </div>
  );
}

function EditTargetModal({
  open,
  onClose,
  currentTarget,
}: {
  open: boolean;
  onClose: () => void;
  currentTarget: number;
}) {
  const [target, setTarget] = useState(currentTarget);
  const [state, action, pending] = useFormAction(updateWelfareTarget, onClose);

  useEffect(() => {
    if (open) setTarget(currentTarget);
  }, [open, currentTarget]);

  const PRESETS = [10, 15, 20, 25, 30, 50, 100];

  function adjust(delta: number) {
    setTarget((prev) => Math.max(1, Math.round((prev + delta) * 100) / 100));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Expected Monthly Dues"
      subtitle="Adjust Target Amount"
      icon={Coins}
      compact
    >
      <form action={action} className="space-y-5 pb-2 text-left">
        <div>
          <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-2">
            Expected Monthly Amount (GH₵)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjust(-5)}
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center text-sm transition-colors cursor-pointer"
              title="Decrease by 5"
            >
              -5
            </button>
            <div className="relative flex-1">
              <input
                name="target"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={target}
                onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
                className="w-full rounded-2xl bg-slate-50 border-none h-12 text-center text-lg font-black text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
              />
            </div>
            <button
              type="button"
              onClick={() => adjust(5)}
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center text-sm transition-colors cursor-pointer"
              title="Increase by 5"
            >
              +5
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mt-2">
            Annual: GH₵ {(target * 12).toFixed(2)} / member
          </p>
        </div>

        {/* Quick Presets */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1.5">
            Quick Presets
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTarget(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  target === p
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                GH₵ {p}
              </button>
            ))}
          </div>
        </div>

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button type="submit" disabled={pending} className={cn(buttonStyles.submit, "flex-1 !h-12 !mt-0")}>
            {pending ? "Saving…" : "Save Target"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
