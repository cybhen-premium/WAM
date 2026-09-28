"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import { 
  Plus, 
  Search, 
  ChevronDown, 
  HandHeart, 
  UserPlus, 
  Pencil, 
  Trash2, 
  UserMinus, 
  UserRoundCheck,
  Phone 
} from "lucide-react";
import { registerPerson, setPersonActive, deletePerson } from "./actions";
import { Modal, TextField, SelectField, buttonStyles } from "@/components/ui";
import { MARITAL_STATUSES, MEMBER_CATEGORIES } from "@/lib/constants";
import { useSetUrlParam } from "@/components/use-url-param";

const FILTER_OPTIONS = [
  { value: "all", label: "All People" },
  { value: "visiting", label: "Visiting" },
  { value: "staying", label: "Staying" },
];

export function PeriodDropdown({ currentPeriod, months }: { currentPeriod: string; months: { month: string; n: number }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function updatePeriod(value: string) {
    const next = new URLSearchParams(params);
    if (value === "all") {
      next.delete("period");
    } else {
      next.set("period", value);
    }
    // Preserve search and status parameters
    const q = params.get("q");
    const status = params.get("status");
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    startTransition(() => router.replace(`${pathname}?${next}`));
  }

  if (months.length === 0) return null;

  return (
    <div className="flex justify-start">
      <div className="relative w-[200px]">
        <select
          value={currentPeriod}
          onChange={(e) => updatePeriod(e.target.value)}
          className="w-full appearance-none rounded-xl bg-white shadow-sm pl-3 pr-8 h-10 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
          aria-label="Time period"
        >
          <option value="all">All Time</option>
          {months.map((m) => {
            const label = m.month
              ? new Date(m.month + "-01").toLocaleDateString("default", { month: "long", year: "numeric" })
              : "Unknown";
            return (
              <option key={m.month || "unknown"} value={m.month || ""}>
                {label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
      </div>
    </div>
  );
}

export function AkwaabaHeader() {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Akwaaba Reception</h1>
        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
          Register and welcome new people (visiting & staying)
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setAdding(true)} className={buttonStyles.primary}>
          <Plus /> Register Person
        </button>
        <PersonFormModal open={adding} onClose={() => setAdding(false)} />
      </div>
    </div>
  );
}

/* Search + Filter toolbar -------------------------------------------------- */

export function AkwaabaFilters(props: {
  q: string;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(props.q);
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Preserve period parameter
    const period = params.get("period");
    if (period) next.set("period", period);
    startTransition(() => router.replace(`${pathname}?${next}`));
  }

  useEffect(() => {
    if (q === props.q) return;
    const t = setTimeout(() => update("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const select =
    "h-11 md:h-10 w-full appearance-none rounded-xl bg-white shadow-sm pl-3 pr-8 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-100";

  return (
    <div className="flex flex-col md:flex-row gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
      <div className="relative flex-grow">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, or profession..."
          className="w-full pl-9 h-11 md:h-10 text-xs rounded-xl bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
        />
      </div>
      <div className="relative w-full md:w-[180px]">
        <select value={props.status} onChange={(e) => update("status", e.target.value)} className={select} aria-label="Status">
          <option value="">All Status</option>
          {FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
      </div>
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function PersonRowActions({ person }: { person: any }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex items-center gap-1">
      <button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await setPersonActive(person.id, !person.active);
          });
        }}
        className={buttonStyles.ghost}
        title={person.active ? "Mark inactive" : "Reactivate"}
        aria-label={person.active ? "Mark inactive" : "Reactivate"}
      >
        {person.active ? <UserMinus /> : <UserRoundCheck />}
      </button>
      {confirmDelete ? (
        <button
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await deletePerson(person.id);
            });
          }}
          onBlur={() => setConfirmDelete(false)}
          autoFocus
          className="h-8 rounded-lg bg-red-600 px-2 text-[10px] font-black uppercase text-white"
        >
          Confirm
        </button>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className={`${buttonStyles.ghost} hover:text-red-600 hover:bg-red-50`}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 />
        </button>
      )}
    </div>
  );
}

/* Add / edit form ---------------------------------------------------------- */

function PersonFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, action, pending] = useFormAction(registerPerson, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register New Person"
      subtitle="Akwaaba Reception"
      icon={UserPlus}
    >
      <form action={action} className="space-y-5 md:space-y-6 pb-2 text-left">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <TextField className="sm:col-span-2" label="Full Name" name="fullName" required placeholder="Enter person's full name" />
          <TextField label="Date" name="joinedAt" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
          <TextField label="Phone Number" name="phone" type="tel" icon={Phone} placeholder="024XXXXXXX" />
          <SelectField label="Gender" name="gender" options={["Male", "Female"]} defaultValue="Male" />
          <SelectField label="Status (Visit or Join?)" name="status" options={["Visiting", "Staying"]} defaultValue="Visiting" />
          <TextField label="Who brought you?" name="invitedBy" placeholder="Name of inviter" />
          <TextField className="sm:col-span-2" label="Residential Address" name="address" placeholder="House number, Street, Area" />
        </div>
        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Registering…" : "Register Person"}
        </button>
      </form>
    </Modal>
  );
}
