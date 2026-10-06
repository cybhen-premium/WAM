"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  ChevronDown, 
  HandHeart, 
  UserPlus, 
  Pencil,
  Printer,
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
  { value: "visiting", label: "Visiting" },
  { value: "staying", label: "Staying" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PeriodDropdown({ currentPeriod, years }: { currentPeriod: string; years: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const selYear = currentPeriod.slice(0, 4);
  const selMonth = currentPeriod.length === 7 ? currentPeriod.slice(5, 7) : "";

  function updatePeriod(value: string) {
    const next = new URLSearchParams(params);
    next.set("period", value);
    // Preserve search and status parameters
    const q = params.get("q");
    const status = params.get("status");
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    startTransition(() => router.replace(`${pathname}?${next}`));
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative w-[200px]">
        <select
          value={selYear}
          onChange={(e) => updatePeriod(e.target.value)}
          className="w-full appearance-none rounded-xl bg-white shadow-sm pl-3 pr-8 h-10 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-100 cursor-pointer"
          aria-label="Filter by year"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
      </div>
      <div className="relative w-[200px]">
        <select
          value={selMonth}
          onChange={(e) => updatePeriod(e.target.value ? `${selYear}-${e.target.value}` : selYear)}
          className="w-full appearance-none rounded-xl bg-white shadow-sm pl-3 pr-8 h-10 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-100 cursor-pointer"
          aria-label="Filter by month"
        >
          <option value="">All Months</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
      </div>
    </div>
  );
}

export type DepartmentOption = { id: string; name: string };

export function AkwaabaHeader({ printHref, departments = [] }: { printHref: string; departments?: DepartmentOption[] }) {
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
        {/* One click prints the people received (the report page itself has the month / section
            controls, and it splits visitors and staying into their own sections). */}
        <Link href={printHref} target="_blank" className={buttonStyles.outline}>
          <Printer className="h-4 w-4" /> Print
        </Link>
        <button onClick={() => setAdding(true)} className={buttonStyles.primary}>
          <Plus /> Register Person
        </button>
        <PersonFormModal open={adding} onClose={() => setAdding(false)} departments={departments} />
      </div>
    </div>
  );
}

/* Search + Filter toolbar -------------------------------------------------- */

export function AkwaabaFilters(props: {
  q: string;
  status: string;
  /** The same year/month combo box that drives the cards, repeated next to the table it filters. */
  period: string;
  years: string[];
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
    <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
      <div className="relative flex-grow min-w-[200px]">
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
      {/* Year + month combo box — filters the list (and the cards) to what was received then */}
      <PeriodDropdown currentPeriod={props.period} years={props.years} />
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function PersonRowActions({ person, departments = [] }: { person: any; departments?: DepartmentOption[] }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex items-center gap-1">
      <button
        disabled={pending}
        onClick={() => setEditing(true)}
        className={buttonStyles.ghost}
        title="Edit"
        aria-label="Edit"
      >
        <Pencil />
      </button>
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
      <PersonFormModal open={editing} onClose={() => setEditing(false)} person={person} departments={departments} />
    </div>
  );
}

/* Add / edit form ---------------------------------------------------------- */

function PersonFormModal({
  open,
  onClose,
  person,
  departments = [],
}: {
  open: boolean;
  onClose: () => void;
  person?: any;
  departments?: DepartmentOption[];
}) {
  const [state, action, pending] = useFormAction(registerPerson, onClose);
  const isEditing = !!person;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Person" : "Register New Person"}
      subtitle="Akwaaba Reception"
      icon={UserPlus}
    >
      <form action={action} className="space-y-5 md:space-y-6 pb-2 text-left">
        {isEditing && <input type="hidden" name="id" value={person.id} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <TextField className="sm:col-span-2" label="Full Name" name="fullName" required placeholder="Enter person's full name" defaultValue={person?.fullName} />
          <TextField label="Date" name="joinedAt" type="date" defaultValue={person?.joinedAt || new Date().toISOString().split("T")[0]} required />
          <TextField label="Phone Number" name="phone" type="tel" icon={Phone} placeholder="024XXXXXXX" defaultValue={person?.phone} />
          <SelectField label="Gender" name="gender" options={["Male", "Female"]} defaultValue={person?.gender || "Male"} />
          <SelectField label="Status (Visit or Join?)" name="status" options={["Visiting", "Staying"]} defaultValue={(person?.akwaabaStatus === "staying" && !person?.convertedAt) ? "Staying" : "Visiting"} />
          <SelectField
            label="Department"
            name="departmentId"
            options={[{ label: "None", value: "" }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
            defaultValue={person?.departmentId ?? ""}
          />
          <TextField label="Who brought you?" name="invitedBy" placeholder="Name of inviter" defaultValue={person?.invitedBy} />
          <TextField className="sm:col-span-2" label="Residential Address" name="address" placeholder="House number, Street, Area" defaultValue={person?.address} />
        </div>
        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? (isEditing ? "Updating…" : "Registering…") : (isEditing ? "Update Person" : "Register Person")}
        </button>
      </form>
    </Modal>
  );
}
