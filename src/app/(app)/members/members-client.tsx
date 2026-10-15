"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormAction } from "@/components/use-form-action";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Briefcase,
  Cake,
  Camera,
  ChevronDown,
  Download,
  Eye,
  Filter,
  Heart,
  Mail,
  MapPin,
  Maximize2,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  UserRoundCheck,
  Users,
  X,
  KeyRound,
  Smartphone,
} from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { schema } from "@/db";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MARITAL_STATUSES, MEMBER_CATEGORIES } from "@/lib/constants";
import {
  checkMemberDuplicate,
  deleteMember,
  importMembers,
  saveMember,
  setMemberActive,
} from "./actions";
import { cn } from "@/lib/utils";

type Member = InferSelectModel<typeof schema.member>;
type Department = InferSelectModel<typeof schema.department>;

const AVATAR_COLORS = [
  "from-blue-500 to-indigo-700",
  "from-purple-500 to-violet-700",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function fmtDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDayShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function compressImageFile(file: File, maxDimension = 512, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* Header buttons ----------------------------------------------------------- */

export function MembersToolbar({ departments }: { departments: Department[] }) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
      <Link href="/welfare" className={`${buttonStyles.outline} flex-1 sm:flex-none`}>
        <Cake className="text-pink-500" /> Member Care
      </Link>
      <div className="flex gap-2 flex-1 sm:flex-none">
        <a href="/members/export" className={`${buttonStyles.outline} flex-1 sm:flex-none`}>
          <Download /> Export
        </a>
        <button onClick={() => setImporting(true)} className={`${buttonStyles.outline} flex-1 sm:flex-none`}>
          <Upload /> Import
        </button>
      </div>


      <button onClick={() => setAdding(true)} className={`${buttonStyles.primary} w-full sm:w-auto`}>
        <Plus /> Add Member
      </button>

      <MemberFormModal open={adding} onClose={() => setAdding(false)} departments={departments} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

/* Search + filters (URL driven) -------------------------------------------- */

/**
 * Groups offered by the "All Groups" filter. Visitors and regular attendees are still in the Akwaaba
 * journey (they are not members yet) and children belong with the juniors, so none of them are
 * offered here — they stay valid member categories in the forms, and anyone already carrying one is
 * still listed under "All Groups".
 */
const GROUP_FILTERS = MEMBER_CATEGORIES.filter(
  (c) => !["Visitor", "Regular Attendee", "Children"].includes(c),
);

export function MemberFilters(props: {
  q: string;
  group: string;
  departmentId: string;
  status: "active" | "inactive";
  duplicate?: string;
  duplicateNamesCount?: number;
  duplicateContactsCount?: number;
  totalDuplicatesCount?: number;
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
    next.delete("page");
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
    <div className="flex flex-col lg:flex-row gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
      <div className="relative flex-grow">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, or profession..."
          className="w-full pl-9 h-11 md:h-10 text-xs rounded-xl bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
        />
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
        <div className="relative flex-1 sm:flex-none sm:w-[150px]">
          <select value={props.group} onChange={(e) => update("group", e.target.value)} className={select} aria-label="Ministry">
            <option value="">All Ministries</option>
            {GROUP_FILTERS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
        <div className="relative flex-1 sm:flex-none sm:w-[150px]">
          <select value={props.departmentId} onChange={(e) => update("departmentId", e.target.value)} className={select} aria-label="Department">
            <option value="">All Departments</option>
            {props.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
        <div className="relative flex-1 sm:flex-none sm:w-[170px]">
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
        <div className="relative flex-1 sm:flex-none sm:w-[170px]">
          <select
            value={props.duplicate ?? ""}
            onChange={(e) => update("duplicate", e.target.value)}
            className={`${select} ${props.duplicate ? "text-amber-800 font-bold bg-amber-50/70 border border-amber-300" : ""}`}
            aria-label="Duplicates Check"
          >
            <option value="">All Records</option>
            <option value="names">⚠️ Duplicate Names ({props.duplicateNamesCount ?? 0})</option>
            <option value="contact">⚠️ Duplicate Contacts ({props.duplicateContactsCount ?? 0})</option>
            <option value="any">⚠️ Any Duplicates ({props.totalDuplicatesCount ?? 0})</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   MEMBER TABLE ROW (Polished, Enterprise Design)
=========================================================================== */
export function MemberTableRow({
  member,
  department,
  departments,
  isDuplicateName,
  isDuplicateContact,
}: {
  member: Member;
  department: Department | null;
  departments: Department[];
  isDuplicateName?: boolean;
  isDuplicateContact?: boolean;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  return (
    <tr className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors">
      {/* 1. Member Profile (Avatar + Full Name + Status) */}
      <td className="py-2.5 pl-4 sm:pl-5 pr-2.5">
        <div className="flex items-center gap-3">
          {member.photoUrl ? (
            <button
              type="button"
              onClick={() => setZoomImage(member.photoUrl)}
              className="relative group/photo shrink-0 cursor-zoom-in focus:outline-none"
              title={`Click to zoom ${member.fullName}'s photo`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={member.photoUrl}
                alt={member.fullName}
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-slate-100 shadow-2xs transition-transform duration-200 group-hover/photo:scale-105 group-hover/photo:ring-blue-500"
              />
              <div className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Maximize2 className="h-3 w-3" />
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="shrink-0 focus:outline-none"
              title={`Click to view ${member.fullName}'s profile`}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-[11px] font-bold uppercase shadow-2xs transition-transform duration-200 hover:scale-105",
                  avatarColor(member.fullName)
                )}
              >
                {initials(member.fullName)}
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="min-w-0 text-left focus:outline-none group/name"
            title={`Click to view ${member.fullName}'s profile`}
          >
            <div className="flex items-center gap-1.5 flex-nowrap">
              <span className="font-bold text-slate-900 truncate max-w-[170px] leading-snug group-hover/name:text-blue-600 transition-colors text-[13px]">
                {member.fullName}
              </span>
              {member.memberIdCode && (
                <span className="font-mono text-[9.5px] font-bold text-slate-600 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200/80 shrink-0 leading-none tracking-tight">
                  {member.memberIdCode}
                </span>
              )}
              {isDuplicateName && (
                <span
                  className="inline-flex items-center gap-0.5 font-bold text-[8.5px] uppercase tracking-wider bg-amber-50 border border-amber-300 text-amber-800 px-1 py-0.2 rounded shrink-0"
                  title="Another member in this church has this same name"
                >
                  <AlertCircle className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                  Duplicate
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] leading-tight">
              {member.occupation && (
                <>
                  <span
                    className="font-medium text-slate-500 truncate max-w-[130px] whitespace-nowrap"
                    title={member.occupation}
                  >
                    {member.occupation}
                  </span>
                  <span className="text-slate-300 select-none">·</span>
                </>
              )}
              {member.baptismStatus === "Awaiting Baptism" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  Awaiting Baptism
                </span>
              ) : member.baptized ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Baptized
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-slate-400 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                  Unbaptized
                </span>
              )}
            </div>
          </button>
        </div>
      </td>

      {/* 2. Ministry */}
      <td className="py-2.5 px-2.5 sm:px-3">
        {member.category && member.category !== "General Member" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
            <Sparkles className="h-3 w-3 text-purple-500 shrink-0" />
            <span>{member.category}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
            <Shield className="h-3 w-3 text-slate-400 shrink-0" />
            <span>General Member</span>
          </span>
        )}
      </td>

      {/* 3. Department */}
      <td className="py-2.5 px-2.5 sm:px-3">
        {department ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/80 border border-blue-200/60 px-2.5 py-0.5 text-xs font-medium text-blue-700 whitespace-nowrap">
            <Users className="h-3 w-3 text-blue-500 shrink-0" />
            <span>{department.name}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300 font-medium">—</span>
        )}
      </td>

      {/* 4. Contact Details */}
      <td className="py-2.5 px-2.5 sm:px-3">
        {member.phone ? (
          <div className="flex flex-col">
            <a
              href={`tel:${member.phone}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors font-mono tracking-tight whitespace-nowrap"
            >
              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
              <span>{member.phone}</span>
            </a>
            {isDuplicateContact && (
              <div className="mt-0.5">
                <span
                  className="inline-flex items-center gap-0.5 font-bold text-[8.5px] uppercase tracking-wider bg-rose-50 border border-rose-300 text-rose-800 px-1 py-0.2 rounded shrink-0"
                  title="Another member in this church shares this contact phone number"
                >
                  <AlertCircle className="h-2.5 w-2.5 text-rose-600 shrink-0" />
                  Duplicate
                </span>
              </div>
            )}
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 truncate max-w-[150px] mt-0.5 whitespace-nowrap"
                title={member.email}
              >
                <Mail className="h-2.5 w-2.5 text-slate-300 shrink-0" />
                <span className="truncate">{member.email}</span>
              </a>
            )}
          </div>
        ) : member.email ? (
          <a
            href={`mailto:${member.email}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 truncate max-w-[150px] whitespace-nowrap"
            title={member.email}
          >
            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">{member.email}</span>
          </a>
        ) : (
          <span className="text-xs text-slate-300 font-medium">—</span>
        )}
      </td>

      {/* 5. Location */}
      <td className="py-2.5 px-2.5 sm:px-3">
        {member.address ? (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 max-w-[130px] truncate whitespace-nowrap"
            title={member.address}
          >
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">{member.address}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300 font-medium">—</span>
        )}
      </td>

      {/* 6. Celebrations & Care */}
      <td className="py-2.5 px-2.5 sm:px-3">
        {member.dateOfBirth || member.weddingAnniversary ? (
          <div className="flex flex-col gap-1 items-start">
            {member.dateOfBirth && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 whitespace-nowrap">
                <Cake className="h-3 w-3 text-amber-500 shrink-0" />
                <span>{fmtDayShort(member.dateOfBirth)}</span>
              </span>
            )}
            {member.weddingAnniversary && (
              <span className="inline-flex items-center gap-1 rounded-md bg-pink-50 border border-pink-200/60 px-1.5 py-0.5 text-[11px] font-semibold text-pink-700 whitespace-nowrap">
                <Heart className="h-3 w-3 fill-pink-500 text-pink-500 shrink-0" />
                <span>{fmtDayShort(member.weddingAnniversary)}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-300 font-medium">—</span>
        )}
      </td>

      {/* 7. Actions */}
      <td className="py-2.5 pl-2.5 pr-4 sm:pr-5 text-right whitespace-nowrap">
        <div className="inline-flex items-center justify-end gap-1">
          {member.phone && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const { sendPortalInviteSms } = await import("./actions");
                  const res = await sendPortalInviteSms(member.id);
                  if (res.ok) {
                    toast.success(`Portal ID sent via SMS to ${member.fullName}!`);
                  } else {
                    toast.error(res.error || "Failed to send Portal SMS");
                  }
                });
              }}
              className="h-8 w-8 rounded-lg border border-slate-200/90 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-500 transition-colors shadow-2xs inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="Send Member Portal ID via SMS"
              aria-label="Send Member Portal ID via SMS"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-8 w-8 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-100 hover:text-slate-900 text-slate-500 transition-colors shadow-2xs inline-flex items-center justify-center cursor-pointer"
            title="Edit member details"
            aria-label="Edit member details"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await setMemberActive(member.id, !member.active);
                toast.success(member.active ? "Member marked inactive" : "Member reactivated");
              });
            }}
            className="h-8 w-8 rounded-lg border border-slate-200/90 bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-slate-500 transition-colors shadow-2xs inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
            title={member.active ? "Mark inactive" : "Reactivate"}
            aria-label={member.active ? "Mark inactive" : "Reactivate"}
          >
            {member.active ? <UserMinus className="h-3.5 w-3.5" /> : <UserRoundCheck className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-8 w-8 rounded-lg border border-slate-200/90 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 transition-colors shadow-2xs inline-flex items-center justify-center cursor-pointer"
            title="Delete member record"
            aria-label="Delete member record"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Dialogs & Modals */}
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${member.fullName}?`}
          description={`Are you sure you want to delete ${member.fullName}? This will permanently remove their records from the church directory. This action cannot be undone.`}
          confirmLabel="Delete Member"
          onConfirm={async () => {
            await deleteMember(member.id);
          }}
          successMessage="Member deleted successfully."
          errorMessage="Failed to delete member."
        />
        <MemberProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          member={member}
          department={department ?? null}
          onEdit={() => {
            setProfileOpen(false);
            setEditing(true);
          }}
          onDelete={() => {
            setProfileOpen(false);
            setConfirmDelete(true);
          }}
          onZoomImage={(url) => setZoomImage(url)}
        />
        <MemberFormModal open={editing} onClose={() => setEditing(false)} member={member} departments={departments} />

        {/* Full Photo Lightbox */}
        {zoomImage && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
            onClick={() => setZoomImage(null)}
          >
            <div
              className="relative max-w-2xl max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="absolute -top-12 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors cursor-pointer"
                title="Close image"
              >
                <X className="h-6 w-6" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomImage}
                alt={member.fullName}
                className="max-h-[80vh] w-auto rounded-3xl object-contain shadow-2xl ring-2 ring-white/20"
              />
              <p className="mt-3 text-sm font-bold text-white text-center">{member.fullName}</p>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

/* Interactive Table Cell (Legacy support) ---------------------------------- */

export function MemberProfileCell({
  member,
  department,
  departments,
}: {
  member: Member;
  department: Department | null;
  departments: Department[];
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="group flex items-center gap-3 text-left focus:outline-none w-full"
        title={`View ${member.fullName}'s profile`}
      >
        <div className="relative shrink-0">
          {member.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.photoUrl}
              alt={member.fullName}
              className="h-10 w-10 shrink-0 rounded-2xl object-cover border border-slate-200 shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-hover:ring-2 group-hover:ring-[#1e3a8a]/40"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#1e3a8a] text-xs font-black transition-all duration-200 group-hover:scale-105 group-hover:bg-blue-100 group-hover:shadow-sm">
              {initials(member.fullName)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate transition-colors duration-200 group-hover:text-[#1e3a8a]">
            {member.fullName}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {member.baptized ? "Baptized" : "Not Baptized"}
            {member.occupation ? ` · ${member.occupation}` : ""}
          </p>
        </div>
      </button>

      {/* Member Bold Profile Modal */}
      <MemberProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        member={member}
        department={department}
        onEdit={() => {
          setProfileOpen(false);
          setEditing(true);
        }}
        onZoomImage={(url) => setZoomImage(url)}
      />

      {/* Edit Modal */}
      <MemberFormModal
        open={editing}
        onClose={() => setEditing(false)}
        member={member}
        departments={departments}
      />

      {/* Full Photo Lightbox */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute -top-12 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
              title="Close image"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomImage}
              alt={member.fullName}
              className="max-h-[80vh] w-auto rounded-3xl object-contain shadow-2xl ring-2 ring-white/20"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-3 text-sm font-bold text-white text-center">{member.fullName}</p>
          </div>
        </div>
      )}
    </>
  );
}

/* Bold Member Profile Modal ------------------------------------------------ */

export function MemberProfileModal({
  open,
  onClose,
  member,
  department,
  onEdit,
  onDelete,
  onZoomImage,
}: {
  open: boolean;
  onClose: () => void;
  member: Member;
  department: Department | null;
  onEdit: () => void;
  onDelete?: () => void;
  onZoomImage: (url: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in-0 duration-200" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 border border-slate-100 text-left"
      >
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-white/95 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Member Profile</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
          {/* Hero Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left pb-5 border-b border-slate-100">
            {/* Avatar */}
            {member.photoUrl ? (
              <div
                onClick={() => onZoomImage(member.photoUrl!)}
                className="group relative cursor-pointer shrink-0"
                title="Click to view full photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={member.photoUrl}
                  alt={member.fullName}
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-cover ring-4 ring-slate-100 shadow-md transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 rounded-2xl bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <Maximize2 className="h-3 w-3" /> Zoom
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white text-3xl font-black shadow-md ring-4 ring-slate-100",
                  avatarColor(member.fullName)
                )}
              >
                {initials(member.fullName)}
              </div>
            )}

            {/* Identity Info & Action Buttons */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {member.fullName}
                </h2>
                {member.occupation && (
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {member.occupation}
                  </p>
                )}
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                {/* Ministry */}
                <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200/80 px-2.5 py-1 text-xs font-bold text-purple-700">
                  <Sparkles className="h-3 w-3 text-purple-600 shrink-0" />
                  <span>{member.category}</span>
                </span>

                {/* Department */}
                {department ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200/80 px-2.5 py-1 text-xs font-bold text-blue-700">
                    <Users className="h-3 w-3 text-blue-500 shrink-0" />
                    <span>{department.name}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs text-slate-400 italic px-1">
                    No Department
                  </span>
                )}

                {/* Status */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border",
                    member.active
                      ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
                      : "bg-rose-50 border-rose-200/80 text-rose-700"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      member.active ? "bg-emerald-500" : "bg-rose-500"
                    )}
                  />
                  <span>{member.active ? "Active" : "Inactive"}</span>
                </span>

                {/* Baptism */}
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200/70 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {member.baptized ? "Baptized" : "Unbaptized"}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1.5">
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-slate-600" />
                    <span>Call</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Profile</span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/70 px-3.5 py-2 text-xs font-bold text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Member Portal Access Card */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-700" />
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-950">
                  Member Portal Access
                </span>
              </div>
              <span className="font-mono text-xs font-black text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200/80 shadow-2xs">
                ID: {member.memberIdCode || "Generating..."}
              </span>
            </div>

            <p className="text-xs text-blue-900/80 leading-relaxed font-medium">
              Members use this ID to sign into the Member Portal to upload their photo, view monthly tithes and welfare dues, and send pastoral inquiries.
            </p>

            <div className="flex items-center gap-2 pt-1">
              {member.phone ? (
                <button
                  type="button"
                  onClick={async () => {
                    const { sendPortalInviteSms } = await import("./actions");
                    const res = await sendPortalInviteSms(member.id);
                    if (res.ok) {
                      toast.success(`Portal ID sent via SMS to ${member.fullName}!`);
                    } else {
                      toast.error(res.error || "Failed to send SMS");
                    }
                  }}
                  className="h-8 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Send Portal Login SMS</span>
                </button>
              ) : (
                <span className="text-[11px] text-amber-700 font-bold">
                  (Add phone number to send portal SMS)
                </span>
              )}
            </div>
          </div>

          {/* Section 1: Contact & Location */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Contact & Location
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Phone</p>
                  {member.phone ? (
                    <a href={`tel:${member.phone}`} className="font-bold text-slate-900 hover:text-blue-600 truncate block">
                      {member.phone}
                    </a>
                  ) : (
                    <p className="font-semibold text-slate-400">—</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                  {member.email ? (
                    <a href={`mailto:${member.email}`} className="font-bold text-slate-900 hover:text-blue-600 truncate block">
                      {member.email}
                    </a>
                  ) : (
                    <p className="font-semibold text-slate-400">—</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 sm:col-span-2">
                <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Residential Address</p>
                  <p className="font-bold text-slate-900 truncate">
                    {member.address || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Personal & Church Details */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Personal & Church Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ministry</p>
                <p className="font-bold text-slate-900 mt-0.5">{member.category}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Department</p>
                <p className="font-bold text-slate-900 mt-0.5">{department?.name || "None"}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Gender</p>
                <p className="font-bold text-slate-900 capitalize mt-0.5">{member.gender || "—"}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Marital Status</p>
                <p className="font-bold text-slate-900 mt-0.5">{member.maritalStatus || "—"}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Birthday</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {member.dateOfBirth ? `🎂 ${fmtDay(member.dateOfBirth)}` : "—"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Anniversary</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {member.weddingAnniversary ? `💍 ${fmtDay(member.weddingAnniversary)}` : "—"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Baptism Status</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {member.baptismStatus || (member.baptized ? "Baptized" : "Not Baptized")}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Date Joined</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {member.joinedAt ? fmtDay(member.joinedAt) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Profession & Skills */}
          {(member.occupation || member.skills) && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Gifts & Profession
              </p>
              <div className="space-y-2 text-xs">
                {member.occupation && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Profession / Occupation</span>
                    <p className="font-bold text-slate-900 mt-0.5">{member.occupation}</p>
                  </div>
                )}
                {member.skills && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ministry Gifts & Talents</span>
                    <p className="font-medium text-slate-700 mt-0.5">{member.skills}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Emergency Contact */}
          {(member.emergencyContactName || member.emergencyContactPhone) && (
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Emergency Contact
              </p>
              <p className="text-xs font-bold text-slate-900">
                {member.emergencyContactName || "Relative"}
                {member.emergencyContactPhone ? ` · ${member.emergencyContactPhone}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function MemberRowActions({
  member,
  department,
  departments,
}: {
  member: Member;
  department?: Department | null;
  departments: Department[];
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={() => setProfileOpen(true)}
        className={buttonStyles.ghost}
        title="View profile"
        aria-label="View profile"
      >
        <Eye />
      </button>
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
      <button
        onClick={() => setConfirmDelete(true)}
        className={`${buttonStyles.ghost} hover:text-red-600 hover:bg-red-50`}
        title="Delete"
        aria-label="Delete"
      >
        <Trash2 />
      </button>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${member.fullName}?`}
        description={`Are you sure you want to delete ${member.fullName}? This will permanently remove their records from the church directory. This action cannot be undone.`}
        confirmLabel="Delete Member"
        onConfirm={async () => {
          await deleteMember(member.id);
        }}
        successMessage="Member deleted successfully."
        errorMessage="Failed to delete member."
      />
      <MemberProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        member={member}
        department={department ?? null}
        onEdit={() => {
          setProfileOpen(false);
          setEditing(true);
        }}
        onDelete={() => {
          setProfileOpen(false);
          setConfirmDelete(true);
        }}
        onZoomImage={(url) => setZoomImage(url)}
      />
      <MemberFormModal open={editing} onClose={() => setEditing(false)} member={member} departments={departments} />

      {/* Full Photo Lightbox */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute -top-12 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
              title="Close image"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomImage}
              alt={member.fullName}
              className="max-h-[80vh] w-auto rounded-3xl object-contain shadow-2xl ring-2 ring-white/20"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-3 text-sm font-bold text-white text-center">{member.fullName}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* Add / edit form ---------------------------------------------------------- */

function MemberFormModal({ open, onClose, member, departments }: { open: boolean; onClose: () => void; member?: Member; departments: Department[] }) {
  const [state, action, pending] = useFormAction(saveMember, onClose);
  const [photo, setPhoto] = useState(member?.photoUrl ?? "");
  const [compressing, setCompressing] = useState(false);

  const [fullName, setFullName] = useState(member?.fullName ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPhoto(member?.photoUrl ?? "");
    setFullName(member?.fullName ?? "");
    setPhone(member?.phone ?? "");
    setDuplicateWarning(null);
  }, [member, open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!open) return;
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    if ((!cleanName || cleanName.length < 2) && !cleanPhone) {
      setDuplicateWarning(null);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const res = await checkMemberDuplicate({
        fullName: cleanName,
        phone: cleanPhone,
        excludeId: member?.id,
      });
      if (res?.duplicate && res.message) {
        setDuplicateWarning(res.message);
      } else {
        setDuplicateWarning(null);
      }
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fullName, phone, open, member?.id]);

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
        <input type="hidden" name="photoUrl" value={photo} />

        {/* Member Photo Upload */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
          <div className="relative group shrink-0">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Member preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Camera className="h-8 w-8 text-slate-300 mb-1" />
                  <span className="text-[10px] font-bold text-slate-400">No Photo</span>
                </div>
              )}
            </div>
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto("")}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <p className="text-xs font-bold text-slate-800">Member Picture</p>
            <p className="text-[11px] text-slate-500">
              Upload a clear profile photo for identification and directory cards. Automatically optimized.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-sm transition-all">
                <Camera className="h-3.5 w-3.5 text-[#1e3a8a]" />
                {compressing ? "Optimizing…" : photo ? "Change Picture" : "Upload Picture"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={compressing}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setCompressing(true);
                      const compressed = await compressImageFile(file, 512, 0.85);
                      setPhoto(compressed);
                    } catch {
                      toast.error("Could not process image. Please try another.");
                    } finally {
                      setCompressing(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto("")}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <TextField
            className="sm:col-span-2"
            label="Full Name"
            name="fullName"
            required
            placeholder="Enter member's full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          {/* Real-Time Duplicate Warning Banner (Immediately visible when typing name or phone) */}
          {duplicateWarning && (
            <div className="sm:col-span-2 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-3.5 flex items-start gap-3 text-amber-900 animate-in fade-in duration-200">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-black uppercase tracking-wider text-amber-950">
                  Duplicate Member Detected
                </p>
                <p className="font-medium text-amber-800 mt-0.5 leading-relaxed">
                  {duplicateWarning}
                </p>
                <p className="font-bold text-[11px] text-amber-700 mt-1">
                  Please verify existing member records before saving to prevent duplicate accounts.
                </p>
              </div>
            </div>
          )}

          <TextField
            label="Phone Number"
            name="phone"
            type="tel"
            icon={Phone}
            placeholder="024XXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <SelectField label="Gender" name="gender" options={["Male", "Female"]} defaultValue={member?.gender === "female" ? "Female" : "Male"} />

          <SelectField label="Ministry" name="category" options={MEMBER_CATEGORIES} defaultValue={member?.category ?? "General Member"} />
          <SelectField
            label="Department"
            name="departmentId"
            options={[{ label: "None", value: "" }, ...departments.map(d => ({ label: d.name, value: d.id }))]}
            defaultValue={member?.departmentId ?? ""}
          />
          <SelectField
            label="Baptism Status"
            name="baptized"
            options={["Not Baptized", "Awaiting Baptism", "Baptized"]}
            defaultValue={member?.baptismStatus || (member?.baptized ? "Baptized" : "Not Baptized")}
          />
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
          Upload a CSV with a header row. Recognised columns: <b>Full Name</b>, Photo URL, Phone, Email, Gender, Ministry,
          Baptized, Marital Status, Occupation, Address, Date Of Birth, Wedding Anniversary (dates as YYYY-MM-DD).
          The file from <b>Export</b> can be re-imported as-is.
        </p>
        <div className="rounded-xl bg-blue-50 border border-blue-200/60 p-3 text-xs text-blue-900 font-medium">
          💡 <b>Duplicate Protection:</b> Any rows matching existing members by phone number, name, or email will be automatically skipped to prevent duplicate records.
        </div>
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
