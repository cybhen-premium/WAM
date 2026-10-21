"use client";

import { useRef, useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import Link from "next/link";
import {
  ChevronDown,
  FileChartColumnIncreasing,
  Heart,
  Pencil,
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
  updateTransaction,
  recordContribution,
  recordWelfareOut,
  saveProject,
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
  projects,
}: {
  open: boolean;
  onClose: () => void;
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
        <Heart /> Record Member Care
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Record Member Care" subtitle="Support Disbursement" icon={Heart}>
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
            {pending ? "Saving…" : "Record Member Care"}
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

/* 12-Month Giving Trends Chart with Interactive Tooltip ---------------------- */

export function GivingTrendsChart({
  data,
}: {
  data: { month: string; income: number; expense: number }[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const max = Math.max(1, ...data.flatMap((r) => [r.income, r.expense]));

  const formatMonthName = (m: string) => {
    return new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" });
  };

  const formatFullMonth = (m: string) => {
    return new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  };

  const fmtCedis = (n: number) =>
    "GH₵ " + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            12-Month Giving Trends
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            Hover or tap any month to inspect income, expenses & net balance
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm" /> Expenses
          </span>
        </div>
      </div>

      <div className="relative h-56 pt-10">
        <div className="flex items-end gap-1.5 sm:gap-2 h-full">
          {data.map((r, idx) => {
            const isHovered = hoveredIdx === idx;
            const incPct = (r.income / max) * 100;
            const expPct = (r.expense / max) * 100;
            const net = r.income - r.expense;

            return (
              <div
                key={r.month}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(isHovered ? null : idx)}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-end h-full py-1.5 rounded-xl transition-all cursor-pointer select-none",
                  isHovered ? "bg-slate-100/80 ring-1 ring-slate-200" : "hover:bg-slate-50"
                )}
              >
                {/* Floating Interactive Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="rounded-xl bg-slate-900 text-white shadow-xl px-3 py-2 text-xs min-w-[155px] whitespace-nowrap">
                      <p className="font-black text-[11px] text-slate-200 pb-1 border-b border-slate-700/80 mb-1.5">
                        {formatFullMonth(r.month)}
                      </p>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Income:
                          </span>
                          <span className="font-mono font-black">{fmtCedis(r.income)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Expenses:
                          </span>
                          <span className="font-mono font-black">{fmtCedis(r.expense)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700/80">
                          <span className="text-slate-400 font-bold">Net:</span>
                          <span className={cn("font-mono font-black", net >= 0 ? "text-emerald-300" : "text-rose-300")}>
                            {net >= 0 ? "+" : ""}{fmtCedis(net)}
                          </span>
                        </div>
                      </div>
                      {/* Tooltip caret */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                    </div>
                  </div>
                )}

                {/* Bars */}
                <div className="flex items-end gap-0.5 sm:gap-1 w-full justify-center h-full px-0.5">
                  {/* Income bar */}
                  {r.income > 0 ? (
                    <div
                      className={cn(
                        "w-1/2 max-w-[14px] rounded-t-md bg-emerald-500 transition-all duration-300 shadow-sm",
                        isHovered && "bg-emerald-400 brightness-110"
                      )}
                      style={{ height: `${Math.max(4, incPct)}%` }}
                    />
                  ) : (
                    <div className="w-1/2 max-w-[14px] flex justify-center pb-0.5">
                      <div className="h-0.5 w-1.5 rounded-full bg-slate-200" />
                    </div>
                  )}

                  {/* Expense bar */}
                  {r.expense > 0 ? (
                    <div
                      className={cn(
                        "w-1/2 max-w-[14px] rounded-t-md bg-rose-500 transition-all duration-300 shadow-sm",
                        isHovered && "bg-rose-400 brightness-110"
                      )}
                      style={{ height: `${Math.max(4, expPct)}%` }}
                    />
                  ) : (
                    <div className="w-1/2 max-w-[14px] flex justify-center pb-0.5">
                      <div className="h-0.5 w-1.5 rounded-full bg-slate-200" />
                    </div>
                  )}
                </div>

                {/* Month label */}
                <span
                  className={cn(
                    "text-[9px] font-bold mt-2 transition-colors",
                    isHovered ? "text-blue-700 font-black scale-105" : "text-slate-400"
                  )}
                >
                  {formatMonthName(r.month)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* Edit Transaction --------------------------------------------------------- */

export function EditTransactionButton({
  transaction: t,
  projects = [],
}: {
  transaction: {
    id: string;
    type: "income" | "expense";
    category: string;
    amount: string;
    occurredOn: string;
    description?: string | null;
    projectId?: string | null;
  };
  projects?: Named[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
        title="Edit transaction"
        aria-label="Edit transaction"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {open && (
        <EditTransactionModal
          open={open}
          onClose={() => setOpen(false)}
          transaction={t}
          projects={projects}
        />
      )}
    </>
  );
}

function EditTransactionModal({
  open,
  onClose,
  transaction: t,
  projects = [],
}: {
  open: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    type: "income" | "expense";
    category: string;
    amount: string;
    occurredOn: string;
    description?: string | null;
    projectId?: string | null;
  };
  projects?: Named[];
}) {
  const [state, action, pending] = useFormAction(updateTransaction, onClose);
  const [type, setType] = useState<"income" | "expense">(t.type);
  const [category, setCategory] = useState(t.category);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const defaultDate = typeof t.occurredOn === "string" ? t.occurredOn.slice(0, 10) : today();

  return (
    <Modal open={open} onClose={onClose} title="Edit Transaction" subtitle="Financial Ledger" icon={Wallet}>
      <form action={action} className="space-y-5 text-left">
        <input type="hidden" name="id" value={t.id} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Type"
            name="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as "income" | "expense");
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
          <TextField
            label="Amount (GH₵)"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={t.amount}
            placeholder="0.00"
          />
          <TextField
            label="Date"
            name="date"
            type="date"
            defaultValue={defaultDate}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Description / Details"
              name="description"
              defaultValue={t.description ?? ""}
              placeholder="Optional notes or details..."
            />
          </div>
          {category === "Project Fund" && projects.length > 0 && (
            <SelectField
              className="sm:col-span-2"
              label="Project"
              name="projectId"
              defaultValue={t.projectId ?? ""}
              options={[{ value: "", label: "Select project..." }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
          )}
        </div>
        <ErrorText state={state} />
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button type="submit" disabled={pending} className={buttonStyles.submit}>
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
