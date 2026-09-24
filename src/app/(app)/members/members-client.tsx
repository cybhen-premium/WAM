"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormAction } from "@/components/use-form-action";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  Cake,
  ChevronDown,
  Download,
  Filter,
  Pencil,
  Phone,
  Plus,
  QrCode,
  ScanFace,
  Search,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { schema } from "@/db";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import { MARITAL_STATUSES, MEMBER_CATEGORIES } from "@/lib/constants";
import { deleteMember, importMembers, saveMember, setMemberActive } from "./actions";

type Member = InferSelectModel<typeof schema.member>;
type Department = InferSelectModel<typeof schema.department>;

/* Header buttons ----------------------------------------------------------- */

export function MembersToolbar({ departments }: { departments: Department[] }) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
      <Link href="/welfare" className={`${buttonStyles.outline} flex-1 sm:flex-none`}>
        <Cake className="text-pink-500" /> Welfare
      </Link>
      <div className="flex gap-2 flex-1 sm:flex-none">
        <a href="/members/export" className={`${buttonStyles.outline} flex-1 sm:flex-none`}>
          <Download /> Export
        </a>
        <button onClick={() => setImporting(true)} className={`${buttonStyles.outline} flex-1 sm:flex-none`}>
          <Upload /> Import
        </button>
      </div>
      <a href="/print/member-cards" target="_blank" className={`${buttonStyles.outline} flex-1 sm:flex-none`}>
        <QrCode className="text-[#1e3a8a]" /> QR Cards
      </a>
      <button
        disabled
        title="Biometric check-in is coming soon"
        className={`${buttonStyles.outline} w-full sm:w-auto h-11 md:h-9`}
      >
        <ScanFace className="text-[#1e3a8a]" /> Biometrics
      </button>
      <button onClick={() => setAdding(true)} className={`${buttonStyles.primary} w-full sm:w-auto`}>
        <Plus /> Add Member
      </button>

      <MemberFormModal open={adding} onClose={() => setAdding(false)} departments={departments} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

/* Search + filters (URL driven) -------------------------------------------- */

export function MemberFilters(props: {
  q: string;
  group: string;
  departmentId: string;
  status: "active" | "inactive";
  activeCount: number;
  inactiveCount: number;
  departments: Department[];
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
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
        <div className="relative w-full sm:w-[160px]">
          <select value={props.group} onChange={(e) => update("group", e.target.value)} className={select} aria-label="Group">
            <option value="">All Groups</option>
            {MEMBER_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
        <div className="relative w-full sm:w-[160px]">
          <select value={props.departmentId} onChange={(e) => update("departmentId", e.target.value)} className={select} aria-label="Department">
            <option value="">All Departments</option>
            {props.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
        <div className="relative w-full sm:w-[180px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <select
            value={props.status}
            onChange={(e) => update("status", e.target.value === "active" ? "" : e.target.value)}
            className={`${select} pl-8`}
            aria-label="Status"
          >
            <option value="active">Active ({props.activeCount})</option>
            <option value="inactive">Inactive ({props.inactiveCount})</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function MemberRowActions({ member, departments }: { member: Member; departments: Department[] }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex items-center gap-1">
      <a
        href={`/print/member-cards?id=${member.id}`}
        target="_blank"
        className={buttonStyles.ghost}
        title="Check-in QR card"
        aria-label="Check-in QR card"
      >
        <QrCode />
      </a>
      <button onClick={() => setEditing(true)} className={buttonStyles.ghost} title="Edit" aria-label="Edit">
        <Pencil />
      </button>
      <button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await setMemberActive(member.id, !member.active);
            toast.success(member.active ? "Member deactivated" : "Member activated");
          });
        }}
        className={buttonStyles.ghost}
        title={member.active ? "Mark inactive" : "Reactivate"}
        aria-label={member.active ? "Mark inactive" : "Reactivate"}
      >
        {member.active ? <UserMinus /> : <UserRoundCheck />}
      </button>
      {confirmDelete ? (
        <button
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await deleteMember(member.id);
              toast.success("Member deleted");
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
      <MemberFormModal open={editing} onClose={() => setEditing(false)} member={member} departments={departments} />
    </div>
  );
}

/* Add / edit form ---------------------------------------------------------- */

function MemberFormModal({ open, onClose, member, departments }: { open: boolean; onClose: () => void; member?: Member; departments: Department[] }) {
  const [state, action, pending] = useFormAction(saveMember, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? "Edit Member Profile" : "New Member Profile"}
      subtitle="Registration Registry"
      icon={UserPlus}
    >
      <form action={action} className="space-y-5 md:space-y-6 pb-2 text-left">
        {member && <input type="hidden" name="id" value={member.id} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <TextField className="sm:col-span-2" label="Full Name" name="fullName" required placeholder="Enter member's full name" defaultValue={member?.fullName} />
          <TextField label="Phone Number" name="phone" type="tel" icon={Phone} placeholder="024XXXXXXX" defaultValue={member?.phone ?? ""} />
          <SelectField label="Gender" name="gender" options={["Male", "Female"]} defaultValue={member?.gender === "female" ? "Female" : "Male"} />
          <SelectField label="Member Category" name="category" options={MEMBER_CATEGORIES} defaultValue={member?.category ?? "General Member"} />
          <SelectField 
            label="Department" 
            name="departmentId" 
            options={[{label: "None", value: ""}, ...departments.map(d => ({label: d.name, value: d.id}))]} 
            defaultValue={member?.departmentId ?? ""} 
          />
          <SelectField label="Baptism Status" name="baptized" options={["Not Baptized", "Baptized"]} defaultValue={member?.baptized ? "Baptized" : "Not Baptized"} />
          <SelectField label="Marital Status" name="maritalStatus" options={MARITAL_STATUSES} defaultValue={member?.maritalStatus ?? "Single"} />
          <TextField label="Profession / Occupation" name="occupation" icon={Briefcase} placeholder="e.g., Software Engineer, Nurse" defaultValue={member?.occupation ?? ""} />
          <TextField className="sm:col-span-2" label="Skills & Talents (Ministry Gifts)" name="skills" placeholder="e.g., Singing, Graphic Design, Carpentry, Public Speaking" defaultValue={member?.skills ?? ""} />
          <TextField className="sm:col-span-2" label="Residential Address" name="address" placeholder="House number, Street, Area" defaultValue={member?.address ?? ""} />
          <TextField label="Emergency Contact Name" name="emergencyContactName" placeholder="Next of Kin / Relative" defaultValue={member?.emergencyContactName ?? ""} />
          <TextField label="Emergency Contact Phone" name="emergencyContactPhone" type="tel" placeholder="024XXXXXXX" defaultValue={member?.emergencyContactPhone ?? ""} />
          <TextField label="Birthday" name="dateOfBirth" type="date" defaultValue={member?.dateOfBirth ?? ""} />
          <TextField label="Wedding Anniversary" name="weddingAnniversary" type="date" defaultValue={member?.weddingAnniversary ?? ""} />
        </div>
        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Saving…" : member ? "Save Changes" : "Register Member"}
        </button>
      </form>
    </Modal>
  );
}

/* CSV import --------------------------------------------------------------- */

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, action, pending] = useFormAction(importMembers, onClose);

  return (
    <Modal open={open} onClose={onClose} title="Import Members" subtitle="CSV Upload" icon={Upload}>
      <form action={action} className="space-y-5 text-left">
        <p className="text-sm text-slate-600">
          Upload a CSV with a header row. Recognised columns: <b>Full Name</b>, Phone, Email, Gender, Category,
          Baptized, Marital Status, Occupation, Address, Date Of Birth, Wedding Anniversary (dates as YYYY-MM-DD).
          The file from <b>Export</b> can be re-imported as-is.
        </p>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:text-xs file:font-black file:text-[#1e3a8a]"
        />
        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Importing…" : "Import Members"}
        </button>
      </form>
    </Modal>
  );
}
