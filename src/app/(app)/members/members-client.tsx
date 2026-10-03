"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormAction } from "@/components/use-form-action";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  Cake,
  Camera,
  ChevronDown,
  Download,
  Eye,
  Filter,
  Maximize2,
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
  X,
} from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { schema } from "@/db";
import { Modal, SelectField, TextField, buttonStyles } from "@/components/ui";
import { MARITAL_STATUSES, MEMBER_CATEGORIES } from "@/lib/constants";
import { deleteMember, importMembers, saveMember, setMemberActive } from "./actions";

type Member = InferSelectModel<typeof schema.member>;
type Department = InferSelectModel<typeof schema.department>;

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
            {GROUP_FILTERS.map((c) => (
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

/* Interactive Table Cell (Click to view bold profile) ---------------------- */

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
  onZoomImage,
}: {
  open: boolean;
  onClose: () => void;
  member: Member;
  department: Department | null;
  onEdit: () => void;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/80 animate-in fade-in-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-[95vw] sm:max-w-[560px] overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-white shadow-2xl animate-in fade-in-0 zoom-in-95"
      >
        {/* Banner with sleek navy styling */}
        <div className="relative h-28 bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb] text-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 h-8 w-8 rounded-full bg-black/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/30 transition-all"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 opacity-80 text-[10px] font-black uppercase tracking-widest text-blue-200">
            <span>Member Profile</span>
          </div>
        </div>

        {/* Hero Photo Section (Appearing Boldly!) */}
        <div className="relative px-6 pt-0 pb-6 text-center">
          <div className="-mt-16 mb-3 flex justify-center">
            {member.photoUrl ? (
              <div
                onClick={() => onZoomImage(member.photoUrl!)}
                className="group relative cursor-pointer"
                title="Click to view full photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={member.photoUrl}
                  alt={member.fullName}
                  className="h-32 w-32 sm:h-36 sm:w-36 rounded-3xl object-cover ring-4 ring-white shadow-2xl transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 rounded-3xl bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <div className="flex items-center gap-1 bg-black/50 px-2.5 py-1 rounded-full text-[10px] font-bold">
                    <Maximize2 className="h-3 w-3" /> Zoom
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-32 w-32 sm:h-36 sm:w-36 items-center justify-center rounded-3xl bg-blue-50 text-[#1e3a8a] text-3xl font-black ring-4 ring-white shadow-xl">
                {initials(member.fullName)}
              </div>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {member.fullName}
          </h2>

          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-tight text-slate-700">
              {member.category}
            </span>
            {department && (
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-tight text-[#1e3a8a]">
                {department.name}
              </span>
            )}
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-tight ${
                member.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {member.active ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {member.phone && (
              <a
                href={`tel:${member.phone}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-[#1e3a8a] hover:bg-blue-100 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            )}
            <a
              href={`/print/member-cards?id=${member.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <QrCode className="h-3.5 w-3.5 text-[#1e3a8a]" /> QR Card
            </a>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-900 shadow-sm transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Profile
            </button>
          </div>

          {/* Details Grid */}
          <div className="mt-5 max-h-[46vh] overflow-y-auto px-1 space-y-3 text-left">
            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phone</span>
                <p className="text-xs font-bold text-slate-800">{member.phone || "—"}</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email</span>
                <p className="text-xs font-bold text-slate-800 truncate">{member.email || "—"}</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5 sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Residential Address</span>
                <p className="text-xs font-bold text-slate-800">{member.address || "—"}</p>
              </div>
            </div>

            {/* Personal Details & Milestones */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gender</span>
                <p className="text-xs font-bold text-slate-800 capitalize">{member.gender || "—"}</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Marital Status</span>
                <p className="text-xs font-bold text-slate-800">{member.maritalStatus || "—"}</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Baptism</span>
                <p className="text-xs font-bold text-slate-800">{member.baptized ? "Baptized" : "Not Baptized"}</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Birthday</span>
                <p className="text-xs font-bold text-slate-800">
                  {member.dateOfBirth ? `🎂 ${fmtDay(member.dateOfBirth)}` : "—"}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Anniversary</span>
                <p className="text-xs font-bold text-slate-800">
                  {member.weddingAnniversary ? `💍 ${fmtDay(member.weddingAnniversary)}` : "—"}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Joined</span>
                <p className="text-xs font-bold text-slate-800">
                  {member.joinedAt ? fmtDay(member.joinedAt) : "—"}
                </p>
              </div>
            </div>

            {/* Profession & Gifts */}
            {(member.occupation || member.skills) && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                {member.occupation && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Profession / Occupation</span>
                    <p className="text-xs font-bold text-slate-800">{member.occupation}</p>
                  </div>
                )}
                {member.skills && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Skills & Talents (Ministry Gifts)</span>
                    <p className="text-xs font-medium text-slate-700">{member.skills}</p>
                  </div>
                )}
              </div>
            )}

            {/* Emergency Contact */}
            {(member.emergencyContactName || member.emergencyContactPhone) && (
              <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Emergency Contact</span>
                <p className="text-xs font-bold text-slate-800">
                  {member.emergencyContactName || "Relative"} {member.emergencyContactPhone ? `· ${member.emergencyContactPhone}` : ""}
                </p>
              </div>
            )}
          </div>
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
      <MemberProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        member={member}
        department={department ?? null}
        onEdit={() => {
          setProfileOpen(false);
          setEditing(true);
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

  useEffect(() => {
    setPhoto(member?.photoUrl ?? "");
  }, [member, open]);

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
          Upload a CSV with a header row. Recognised columns: <b>Full Name</b>, Photo URL, Phone, Email, Gender, Category,
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
