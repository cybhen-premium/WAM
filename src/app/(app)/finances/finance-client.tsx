"use client";

import { useRef, useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  FileChartColumnIncreasing,
  Heart,
  Plus,
  Sparkles,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { ComboField, Modal, SelectField, TextAreaField, TextField, buttonStyles } from "@/components/ui";
import { useSetUrlParam } from "@/components/use-url-param";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  addTransaction,
  recordContribution,
  recordWelfareOut,
  saveProject,
  saveVendor,
  type FormState,
} from "./actions";

type Option = { id: string; fullName: string };
type Named = { id: string; name: string };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const today = () => new Date().toISOString().slice(0, 10);

function ErrorText({ state }: { state: FormState }) {
  return state?.error ? <p className="text-sm font-semibold text-red-600">{state.error}</p> : null;
}

/* Header: title, period, AI insights, report, add transaction -------------- */

export function FinanceHeader(props: {
  period: string;
  years: string[];
  vendors: Named[];
  projects: Named[];
}) {
  const [setParam] = useSetUrlParam();
  const [adding, setAdding] = useState(false);
  const [advisor, setAdvisor] = useState(false);

  const selYear = props.period.slice(0, 4);
  const selSub = props.period.length > 4 ? props.period.slice(4) : "";

  function setYear(y: string) {
    // Switching year resets to the whole year
    setParam("period", y);
  }

  function setSub(v: string) {
    // v is "" (whole year), "-Q1..Q4" or "-MM"
    if (!v) {
      setParam("period", selYear);
    } else {
      setParam("period", `${selYear}${v}`);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div className="space-y-2 w-full lg:w-auto">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Financial Hub</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-[160px]">
            <select
              value={selYear}
              onChange={(e) => setYear(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl bg-white border border-slate-200 px-3 pr-8 text-xs font-bold outline-none cursor-pointer"
              aria-label="Filter by year"
            >
              {props.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
          </div>
          <div className="relative w-full sm:w-[200px]">
            <select
              value={selSub}
              onChange={(e) => setSub(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl bg-white border border-slate-200 px-3 pr-8 text-xs font-bold outline-none cursor-pointer"
              aria-label="Filter by quarter or month"
            >
              <option value="">Whole Year</option>
              <optgroup label="Quarters">
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={`-Q${q}`}>
                    Q{q} ({["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][q - 1]})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Months">
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={`-${String(i + 1).padStart(2, "0")}`}>
                    {m}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
        <button
          onClick={() => setAdvisor(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3 flex-1 sm:flex-none h-11 md:h-10 text-[10px] md:text-[11px] font-black rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md active:scale-[0.98]"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI Insights
        </button>
        <Link
          href={`/print/report?period=${props.period}`}
          target="_blank"
          className="inline-flex items-center justify-center gap-1.5 px-3 flex-1 sm:flex-none h-11 md:h-10 text-[10px] md:text-[11px] font-bold rounded-xl border bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
        >
          <FileChartColumnIncreasing className="h-3.5 w-3.5" /> Report
        </Link>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3 w-full sm:w-auto h-11 md:h-10 text-[10px] md:text-[11px] font-black rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Add Transaction
        </button>
      </div>

      <AddTransactionModal open={adding} onClose={() => setAdding(false)} {...props} />
      <AdvisorSheet open={advisor} onClose={() => setAdvisor(false)} />
    </div>
  );
}

function AddTransactionModal({
  open,
  onClose,
  vendors,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  vendors: Named[];
  projects: Named[];
}) {
  const [state, action, pending] = useFormAction(addTransaction, onClose);
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("");

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Modal open={open} onClose={onClose} title="New Transaction" subtitle="Financial Ledger" icon={Wallet}>
      <form action={action} className="space-y-5 text-left">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Type"
            name="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as "income" | "expense");
              setCategory("");
            }}
            options={[
              { value: "income", label: "Income" },
              { value: "expense", label: "Expense" },
            ]}
          />
          <ComboField
            label="Category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Select or type…"
            options={categories}
          />
          <TextField label="Amount (GH₵)" name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
          <TextField label="Date" name="date" type="date" defaultValue={today()} />
          {category === "Project Fund" && projects.length > 0 && (
            <SelectField
              className="sm:col-span-2"
              label="Project"
              name="projectId"
              options={[{ value: "", label: "Select project..." }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
          )}
          {type === "expense" && vendors.length > 0 && (
            <SelectField
              className="sm:col-span-2"
              label="Vendor (optional)"
              name="vendorId"
              options={[{ value: "", label: "No vendor" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
            />
          )}
        </div>
        <ErrorText state={state} />
        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Saving…" : "Save Transaction"}
        </button>
      </form>
    </Modal>
  );
}

/** Slide-over matching the original "Strategic AI Advisor". AI analysis is not wired up yet. */
function AdvisorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 animate-in fade-in-0" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-white shadow-2xl animate-in slide-in-from-right flex flex-col">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-100">
            <Sparkles className="h-3.5 w-3.5" /> Ecclesia Intelligence
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Strategic AI Advisor</h2>
          <p className="text-xs text-indigo-100 mt-1">Deep-Dive Ministry Financial Audit</p>
          <button onClick={onClose} className="absolute right-4 top-4 text-white/60 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50">
            <Target className="h-9 w-9 text-indigo-600" />
          </div>
          <h3 className="mt-5 text-lg font-black text-slate-900">Unlock Financial Prophecy</h3>
          <p className="mt-2 text-sm text-slate-500">
            Our AI will analyze your ratios, detect ministry leaks, and provide actionable growth targets.
          </p>
          <p className="mt-2 text-xs font-bold italic text-indigo-600">Fee: 10 Credits</p>
          <button
            disabled
            title="AI analysis will be enabled once the AI provider is configured"
            className="mt-6 h-12 w-full max-w-xs rounded-xl bg-indigo-600 text-sm font-black text-white shadow-lg disabled:opacity-60"
          >
            Analyze Church Ledger
          </button>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Coming soon</p>
        </div>
      </div>
    </div>
  );
}

/* Small shared controls ---------------------------------------------------- */

export function ReceiptTypeFilter({ categories, value }: { categories: string[]; value: string }) {
  const [setParam] = useSetUrlParam();
  return (
    <div className="relative w-full sm:w-[220px]">
      <select
        value={value}
        onChange={(e) => setParam("category", e.target.value)}
        className="h-10 w-full appearance-none rounded-xl bg-white border border-slate-200 px-3 pr-8 text-xs font-bold outline-none"
        aria-label="Receipt type"
      >
        <option value="">All Types</option>
        {categories.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
    </div>
  );
}

/* Tithes / Dues inline form ------------------------------------------------ */

export function RecordContributionForm({ kind, label, members }: { kind: "tithes" | "dues"; label: string; members: Option[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useFormAction(recordContribution, () => formRef.current?.reset());

  const input = "h-11 w-full rounded-xl bg-white border border-slate-200 px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-100";

  return (
    <form ref={formRef} action={action} className="rounded-[1.5rem] bg-[#1e3a8a] p-5 text-white space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">{label}</p>
      {members.length === 0 ? (
        <p className="text-sm text-blue-100">
          Add members first on the <Link href="/members" className="underline font-bold">Members</Link> page.
        </p>
      ) : (
        <>
          <select name="memberId" required defaultValue="" className={cn(input, "text-slate-900")} aria-label="Member">
            <option value="" disabled>
              Select member...
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">GH₵</span>
              <input name="amount" type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" required placeholder="0.00" className={cn(input, "pl-11 text-slate-900")} aria-label="Amount" />
            </div>
            <input name="date" type="date" defaultValue={today()} className={cn(input, "w-full sm:w-40 text-slate-900")} aria-label="Date" />
          </div>
          {state?.error && <p className="text-xs font-bold text-red-200">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black uppercase tracking-widest disabled:opacity-60"
          >
            {pending ? "Saving…" : label}
          </button>
        </>
      )}
    </form>
  );
}

/* Welfare Out -------------------------------------------------------------- */

export function RecordWelfareButton({ members }: { members: Option[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(recordWelfareOut, () => setOpen(false));

  return (
    <>
      <button onClick={() => setOpen(true)} className={cn(buttonStyles.primary, "bg-pink-600 hover:bg-pink-700")}>
        <Heart /> Record Welfare
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Record Welfare" subtitle="Support Disbursement" icon={Heart}>
        <form action={action} className="space-y-5 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              className="sm:col-span-2"
              label="Beneficiary"
              name="memberId"
              required
              options={[{ value: "", label: "Select member..." }, ...members.map((m) => ({ value: m.id, label: m.fullName }))]}
            />
            <TextField label="Amount (GH₵)" name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
            <TextField label="Date" name="date" type="date" defaultValue={today()} />
            <TextAreaField className="sm:col-span-2" label="Reason / Notes" name="description" rows={2} placeholder="e.g., Hospital bills, bereavement support" />
          </div>
          <ErrorText state={state} />
          <button type="submit" disabled={pending} className={buttonStyles.submit}>
            {pending ? "Saving…" : "Record Welfare"}
          </button>
        </form>
      </Modal>
    </>
  );
}

/* Vendors ------------------------------------------------------------------ */

export function AddVendorButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(saveVendor, () => setOpen(false));

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonStyles.primary}>
        <Plus /> Add Vendor
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Vendor" subtitle="Supplier Directory" icon={Building2}>
        <form action={action} className="space-y-5 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField className="sm:col-span-2" label="Vendor Name" name="name" required placeholder="e.g., ECG, Accra Sound Systems" />
            <TextField label="Service" name="service" placeholder="e.g., Electricity, PA Rental" />
            <TextField label="Contact Person" name="contactName" />
            <TextField label="Phone" name="phone" type="tel" placeholder="024XXXXXXX" />
            <TextField label="Email" name="email" type="email" />
          </div>
          <ErrorText state={state} />
          <button type="submit" disabled={pending} className={buttonStyles.submit}>
            {pending ? "Saving…" : "Save Vendor"}
          </button>
        </form>
      </Modal>
    </>
  );
}

/* Project funds ------------------------------------------------------------ */

export function AddProjectButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(saveProject, () => setOpen(false));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 h-8 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
      >
        <Plus className="h-3.5 w-3.5" /> Project
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Project Fund" subtitle="Fundraising Target" icon={Target}>
        <form action={action} className="space-y-5 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField className="sm:col-span-2" label="Project Name" name="name" required placeholder="e.g., Building Fund" />
            <TextField label="Target (GH₵)" name="target" type="number" min="1" step="0.01" required />
            <TextField label="Due Date (optional)" name="dueOn" type="date" />
          </div>
          <ErrorText state={state} />
          <button type="submit" disabled={pending} className={buttonStyles.submit}>
            {pending ? "Saving…" : "Create Project"}
          </button>
        </form>
      </Modal>
    </>
  );
}
