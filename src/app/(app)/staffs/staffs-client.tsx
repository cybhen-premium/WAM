"use client";

import React, { useState, useTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUpDown, Ban, Check, CheckCircle, ChevronDown,
  Edit2, Eye, EyeOff, Filter, Plus, Search, Shield, Trash2, X, XCircle, Users, Church,
  Mail, Smartphone, RotateCcw, Key,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MODULES, MODULE_KEYS } from "@/lib/modules";
import {
  changeTwoFactorMethod,
  createStaff,
  removeStaff,
  updateStaff,
  setStaffModules,
  updateStaffStatus,
  resendStaffCredentials,
  resetStaffPassword,
} from "./actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTablePagination } from "@/components/table-pagination";

/** "John Doe" -> "johndoe" */
function toUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/* --- Types -------------------------------------------------------------- */

export type ActiveStaff = {
  id: string; userId?: string; name: string; email: string; role: string;
  departmentId?: string;
  departmentName?: string;
  joined: string; self: boolean; status: string; modules: string[];
  twoFactorMethod: string;
  assignedBranches?: Array<{ id: string; name: string }>;
};
export type PendingStaff = {
  id: string; userId?: string; email: string; role: string; invited: string; modules: string[];
  departmentId?: string;
  departmentName?: string;
  twoFactorMethod: string;
  assignedBranches?: Array<{ id: string; name: string }>;
};

const DEFAULT_ROLES = [
  "Admin",
  "Finance",
  "SOB",
  "Akwaaba",
  "Department Lead",
  "Gadites",
  "Angels",
  "Sunday School Instructors",
  "WAM Choreo/Drama",
  "Team Wise",
  "Prayer Warriors",
  "Secretary",
  "Pastor",
  "Elder",
];
const DEFAULT_PASSWORD = "WAMCHURCH@26";

/* --- Module descriptions for the permissions step ----------------------- */
const MODULE_DESC: Record<string, string> = {
  dashboard:          "View church statistics, at-risk members, and celebration alerts.",
  members:            "Manage church member directory, personal details, and profiles.",
  departments:        "Manage church ministry departments and member enrollments.",
  department_portal:  "Admin portal to switch and oversee attendance across all departments.",
  akwaaba:            "Run the first-timer welcome programme and reception intake.",
  visitors:           "Track first-time visitors, conversion stages, and follow-ups.",
  sob:                "Track School of Baptism lesson progress and graduations.",
  tithes:             "Record, verify, and review weekly tithe contributions.",
  finances:           "Manage church income, expenses, receipts, and financial reports.",
  welfare_dues:       "Record and track member welfare dues and monthly contributions.",
  giving_analytics:   "Analyze financial giving trends, monthly breakdown, and averages.",
  growth:             "Monitor membership growth velocity and attendance metrics.",
  welfare:            "Pastoral visits, counseling records, and welfare disbursements.",
  announcements:      "Compose and broadcast church-wide or targeted announcements.",
  messaging:          "Send SMS broadcasts, quick texts, and AI-assisted sermons.",
  analytics:          "View comprehensive church analytics and admin audit logs.",
  staffs:             "Manage staff accounts, credentials, and module permissions.",
  settings:           "Configure church profile, custom branding, and integrations.",
};

/* --- Avatar -------------------------------------------------------------- */
const AVATAR_COLORS = [
  "from-blue-500 to-blue-700", "from-violet-500 to-purple-700",
  "from-emerald-500 to-teal-700", "from-orange-500 to-rose-600",
  "from-cyan-500 to-blue-600", "from-pink-500 to-fuchsia-700",
  "from-amber-500 to-orange-600",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function Avatar({ name }: { name: string }) {
  return (
    <div className={cn(
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-sm font-black uppercase shadow-sm",
      avatarColor(name),
    )}>
      {name.charAt(0)}
    </div>
  );
}

/* --- Badges -------------------------------------------------------------- */
function AccessBadge({ role, departmentName }: { role: string; departmentName?: string }) {
  const map: Record<string, string> = {
    admin: "bg-purple-50 text-purple-700 border-purple-200/70",
    pastor: "bg-blue-50 text-blue-700 border-blue-200/70",
    elder: "bg-sky-50 text-sky-700 border-sky-200/70",
    finance: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    secretary: "bg-amber-50 text-amber-700 border-amber-200/70",
    sob: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
    akwaaba: "bg-rose-50 text-rose-700 border-rose-200/70",
    "department lead": "bg-teal-50 text-teal-700 border-teal-200/70",
    gadites: "bg-orange-50 text-orange-700 border-orange-200/70",
    angels: "bg-cyan-50 text-cyan-700 border-cyan-200/70",
    "sunday school instructors": "bg-lime-50 text-lime-700 border-lime-200/70",
    "wam choreo/drama": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/70",
    "team wise": "bg-violet-50 text-violet-700 border-violet-200/70",
    "prayer warriors": "bg-pink-50 text-pink-700 border-pink-200/70",
  };
  const normalized = role?.toLowerCase() ?? "";
  const display =
    normalized === "admin"
      ? "Admin"
      : normalized === "sob"
      ? "SOB"
      : normalized === "finance"
      ? "Finance"
      : normalized === "akwaaba"
      ? "Akwaaba"
      : normalized === "pastor"
      ? "Pastor"
      : normalized === "elder"
      ? "Elder"
      : normalized === "secretary"
      ? "Secretary"
      : normalized === "gadites"
      ? "Gadites"
      : normalized === "angels"
      ? "Angels"
      : normalized === "sunday school instructors"
      ? "Sunday School Instructors"
      : normalized === "wam choreo/drama"
      ? "WAM Choreo/Drama"
      : normalized === "team wise"
      ? "Team Wise"
      : normalized === "prayer warriors"
      ? "Prayer Warriors"
      : normalized === "department lead"
      ? (departmentName ? `Dept Lead · ${departmentName}` : "Department Lead")
      : role;

  return (
    <div className="flex flex-col gap-1 items-start">
      <span
        className={cn(
          "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold border shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          map[normalized] ?? "bg-slate-50 text-slate-700 border-slate-200/70"
        )}
      >
        {display}
      </span>
      {departmentName && normalized !== "department lead" && (
        <span className="text-[11px] font-semibold text-slate-500">
          Dept: {departmentName}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  const suspended = status === "suspended";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border",
        active
          ? "bg-emerald-50/80 border-emerald-200/80 text-emerald-700"
          : suspended
          ? "bg-rose-50/80 border-rose-200/80 text-rose-700"
          : "bg-amber-50/80 border-amber-200/80 text-amber-700"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : suspended ? "bg-rose-500" : "bg-amber-500"
        )}
      />
      {active ? "Active" : suspended ? "Suspended" : "Pending"}
    </span>
  );
}

function TwoFactorBadge({ method }: { method: string }) {
  const active = method && method !== "none";

  if (!active) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        Off
      </span>
    );
  }

  const isTotp = method === "totp" || method === "auth_app";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-bold border shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
        isTotp
          ? "bg-emerald-50/80 border-emerald-200/80 text-emerald-700"
          : "bg-blue-50/80 border-blue-200/80 text-blue-700"
      )}
    >
      {isTotp ? <Smartphone className="h-3 w-3 text-emerald-600" /> : <Mail className="h-3 w-3 text-blue-600" />}
      {isTotp ? "Auth App" : "Email"}
    </span>
  );
}

/* --- Module toggles panel ------------------------------------------------ */
function ModuleToggles({ staff, disabled }: { staff: { id: string; modules: string[] }; disabled: boolean }) {
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const [localModules, setLocalModules] = useState<string[]>(staff.modules);

  useEffect(() => {
    setLocalModules(staff.modules);
  }, [staff.modules]);

  const assigned = new Set(localModules);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
      {MODULE_KEYS.map((key) => {
        const on = assigned.has(key);
        return (
          <button
            key={key}
            type="button"
            disabled={disabled || busy}
            aria-pressed={on}
            onClick={() => {
              const next = on ? new Set([...assigned].filter((k) => k !== key)) : new Set([...assigned, key]);
              const nextArray = [...next];
              setLocalModules(nextArray);
              startTransition(async () => {
                await setStaffModules(staff.id, nextArray);
                toast.success(`Updated module: ${MODULES[key].label}`);
                router.refresh();
              });
            }}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl p-2.5 text-xs font-bold border transition-all disabled:opacity-50 text-left",
              on
                ? "bg-blue-50/80 border-blue-200 text-blue-700 shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <span className="truncate">{MODULES[key].label}</span>
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px]",
                on
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-slate-300 bg-white"
              )}
            >
              {on && <Check className="h-3 w-3 stroke-[3]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ===========================================================================
   CREATE / EDIT STAFF VIEW — 2-step wizard
=========================================================================== */
function CreateStaffView({
  onClose,
  initialData,
  availableBranches = [],
  currentBranch,
}: {
  onClose: () => void;
  initialData?: ActiveStaff | PendingStaff;
  availableBranches?: Array<{ id: string; name: string }>;
  currentBranch?: { id: string; name: string };
}) {
  const isEditing = !!initialData;
  const [step, setStep] = useState<1 | 2>(1);
  const [showPass, setShowPass] = useState(false);
  const [fullName, setFullName] = useState((initialData as any)?.name || "");
  const [username, setUsername] = useState((initialData as any)?.name ? toUsername((initialData as any).name) : "");
  const [email, setEmail] = useState((initialData as any)?.email || "");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [resetPassword, setResetPassword] = useState(false);
  const [editPassword, setEditPassword] = useState(DEFAULT_PASSWORD);
  const [sendResetEmail, setSendResetEmail] = useState(true);
  const [role, setRole] = useState<string>(initialData?.role || "Akwaaba");
  const [activate, setActivate] = useState(!initialData || (initialData as ActiveStaff).status === "active");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(initialData?.modules || []));

  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(() => {
    if (initialData?.assignedBranches && initialData.assignedBranches.length > 0) {
      return new Set(initialData.assignedBranches.map((b) => b.id));
    }
    return new Set(currentBranch ? [currentBranch.id] : (availableBranches[0] ? [availableBranches[0].id] : []));
  });

  // Auto-generate username from full name
  useEffect(() => { 
    if (!isEditing || !username) setUsername(toUsername(fullName)); 
  }, [fullName, isEditing, username]);

  const [state, formAction, pending] = useActionState(isEditing ? updateStaff : createStaff, undefined);

  // Close on success
  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      if ((state as any).emailSent === false) {
        toast.warning((state as any).message || "Staff created, but credentials email could not be sent.");
      } else {
        toast.success(
          (state as any).message ||
            (isEditing ? "Staff profile updated successfully!" : "Staff created! Login credentials and URL sent to email.")
        );
      }
      onClose();
    }
  }, [state, onClose, isEditing]);

  function toggleModule(key: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function selectAll() { setSelectedModules(new Set(MODULE_KEYS)); }
  function clearAll() { setSelectedModules(new Set()); }

  const emailList = email
    .split(/[,;\n\r]+/)
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);

  const step1Valid =
    Boolean(fullName.trim()) &&
    emailList.length > 0 &&
    emailList.every((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) &&
    selectedBranches.size > 0;

  return (
    <div className="w-full max-w-2xl mx-auto rounded-3xl bg-[#F5F7FB] shadow-md border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
      {/* -- Header -- */}
        <div className="flex items-center gap-4 px-4 sm:px-8 pt-6 sm:pt-8 pb-2">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <div className="flex items-center gap-4 px-4 sm:px-8 pb-6">
          <div className="flex h-12 sm:h-14 w-12 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shrink-0">
            <Shield className="h-6 sm:h-7 w-6 sm:w-7 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {isEditing ? "Edit Staff Account" : "New Staff Account"}
          </h2>
        </div>

        {/* -- Step tabs -- */}
        <div className="mx-4 sm:mx-6 mb-6 grid grid-cols-2 rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <button
            onClick={() => setStep(1)}
            className={cn("py-3 sm:py-3.5 text-xs sm:text-sm font-bold transition-all",
              step === 1 ? "bg-blue-50 text-blue-700" : "text-slate-400 hover:text-slate-600")}
          >
            1. Account Details
          </button>
          <button
            onClick={() => step1Valid && setStep(2)}
            disabled={!step1Valid}
            className={cn("py-3 sm:py-3.5 text-xs sm:text-sm font-bold transition-all",
              step === 2 ? "bg-blue-50 text-blue-700" : "text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50")}
          >
            2. Custom Permissions
          </button>
        </div>

        <form action={formAction}>
          {/* Hidden fields carrying state to server */}
          {isEditing && <input type="hidden" name="staffId" value={initialData.id} />}
          <input type="hidden" name="name"     value={fullName} />
          <input type="hidden" name="username" value={username} />
          <input type="hidden" name="email"    value={email} />
          {!isEditing && <input type="hidden" name="password" value={password} />}
          {isEditing && resetPassword && (
            <>
              <input type="hidden" name="resetPassword" value="on" />
              <input type="hidden" name="password" value={editPassword} />
              {sendResetEmail && <input type="hidden" name="sendCredentialsEmail" value="on" />}
            </>
          )}
          <input type="hidden" name="role"     value={role} />
          {/* Branch assignments */}
          {[...selectedBranches].map((bId) => (
            <input key={bId} type="hidden" name="branchIds" value={bId} />
          ))}
          {/* Temporary Password & Activate */}
          {!isEditing && activate && <input type="hidden" name="activate" value="on" />}
          {[...selectedModules].map((m) => (
            <input key={m} type="hidden" name="modules" value={m} />
          ))}

          {/* === STEP 1: Account Details === */}
          {step === 1 && (
            <div className="mx-4 sm:mx-6 mb-6 rounded-2xl bg-white border border-slate-100 p-4 sm:p-6 space-y-5">

              {/* Full Name + Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-slate-700">Full Name <span className="text-red-500">*</span></span>
                  <input
                    value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-slate-700">Username</span>
                  <input
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  />
                </label>
              </div>

              {/* Email */}
              <label className="block">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-sm font-bold text-slate-700">
                    Email Address <span className="text-red-500">*</span>
                  </span>
                  {!isEditing && (
                    <span className="text-[11px] font-medium text-slate-400">
                      Separate multiple emails with commas
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isEditing ? "jane@example.com" : "jane@example.com, john@example.com"}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                />
              </label>

              {/* Branch Assignment */}
              {availableBranches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="block text-sm font-bold text-slate-700">
                      Branch Sanctuary Access <span className="text-red-500">*</span>
                    </span>
                    {availableBranches.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBranches.size === availableBranches.length) {
                            setSelectedBranches(
                              new Set(currentBranch ? [currentBranch.id] : [availableBranches[0].id])
                            );
                          } else {
                            setSelectedBranches(new Set(availableBranches.map((b) => b.id)));
                          }
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        {selectedBranches.size === availableBranches.length
                          ? "Reset to Current"
                          : "Select All Branches"}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableBranches.map((b) => {
                      const isChecked = selectedBranches.has(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setSelectedBranches((prev) => {
                              const next = new Set(prev);
                              if (next.has(b.id)) {
                                if (next.size > 1) next.delete(b.id); // At least 1 branch
                              } else {
                                next.add(b.id);
                              }
                              return next;
                            });
                          }}
                          className={cn(
                            "flex items-center justify-between gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer",
                            isChecked
                              ? "border-blue-500 bg-blue-50/70 text-blue-950 font-bold"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs",
                                isChecked ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                              )}
                            >
                              <Church className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-bold truncate">
                              {b.name.replace("World Ark Missions - ", "")}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                              isChecked
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 bg-white"
                            )}
                          >
                            {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    User will be granted access to login into the selected branch sanctuaries.
                  </p>
                </div>
              )}

              {/* Role */}
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700">Role</span>
                <input
                  list="roles-list"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Select or type a role..."
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 capitalize outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                />
                <datalist id="roles-list">
                  {DEFAULT_ROLES.map((r) => <option key={r} value={r} />)}
                </datalist>
              </label>

              {/* Temporary Password */}
              {!isEditing && (
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-slate-700">Temporary Password <span className="text-red-500">*</span></span>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 tracking-widest transition-all"
                      />
                      <button type="button" onClick={() => setShowPass((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">The user will be required to change this password on their first login.</p>
                  </label>

                  <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-3 flex items-start gap-2.5">
                    <Mail className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-800 leading-relaxed font-medium">
                      An email containing the <strong>login portal URL</strong> and default password (<span className="font-mono font-bold">{password}</span>) will be automatically sent upon creation.
                    </p>
                  </div>
                </div>
              )}

              {/* Password Management for existing staff */}
              {isEditing && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={resetPassword}
                        onChange={(e) => setResetPassword(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Key className="h-4 w-4 text-blue-600" />
                        Reset user password
                      </span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {resetPassword ? "New password will be set" : "Keeps current password"}
                    </span>
                  </div>

                  {resetPassword ? (
                    <div className="pt-3 space-y-3 border-t border-slate-200/80">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-slate-700">
                          New Temporary Password <span className="text-red-500">*</span>
                        </span>
                        <div className="relative">
                          <input
                            type={showPass ? "text" : "password"}
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="WAMCHURCH@26"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 tracking-widest transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass((v) => !v)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          The user will be required to change this password on their next login.
                        </p>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendResetEmail}
                          onChange={(e) => setSendResetEmail(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-600">
                          Email new login credentials and URL to {email || "staff member"}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Leave this unchecked to keep the user's existing login credentials intact.
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {state && "error" in state && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 border border-red-100">
                  {state.error}
                </p>
              )}

              {/* Activate + Next button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                {!isEditing ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button type="button" onClick={() => setActivate((v) => !v)}
                      className={cn("flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all shrink-0",
                        activate ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white")}>
                      {activate && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </button>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">Activate account immediately</span>
                  </label>
                ) : <div />}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                  {isEditing && (
                    <button
                      type="submit"
                      disabled={!step1Valid || pending}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {pending ? "Saving…" : "Save Changes"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next: Customize Permissions
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === STEP 2: Custom Permissions === */}
          {step === 2 && (
            <div className="mx-4 sm:mx-6 mb-6 rounded-2xl bg-white border border-slate-100 overflow-hidden">
              {/* Sub-header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 cursor-pointer">
                    <ArrowLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <div>
                    <p className="text-sm font-black text-slate-900">Custom Permissions</p>
                    <p className="text-xs text-slate-400">Override role defaults with specific permissions for this user</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <button type="button" onClick={selectAll}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">Select All</button>
                  <span className="text-slate-300">·</span>
                  <button type="button" onClick={clearAll}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 hover:underline cursor-pointer">Use Default</button>
                </div>
              </div>

              {/* Permission grid */}
              <div className="max-h-[380px] overflow-y-auto p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MODULE_KEYS.map((key) => {
                    const on = selectedModules.has(key);
                    return (
                      <button
                        key={key} type="button" onClick={() => toggleModule(key)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer",
                          on ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                          on ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white",
                        )}>
                          {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-900 leading-tight">{MODULES[key].label}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {MODULE_DESC[key]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-400 font-semibold">
                  {selectedModules.size} module{selectedModules.size !== 1 ? "s" : ""} selected
                  {role === "admin" && <span className="ml-1.5 text-purple-600 block sm:inline">(admin gets all modules)</span>}
                </p>
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
                >
                  {pending ? "Saving…" : isEditing ? "Save Changes" : "Create Staff Account"}
                </button>
              </div>

              {state && "error" in state && (
                <p className="mx-6 mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 border border-red-100">
                  {state.error}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
  );
}

/* ===========================================================================
   MAIN STAFFS CLIENT
=========================================================================== */
export function StaffsClient({
  isAdmin,
  active,
  pending,
  availableBranches = [],
  currentBranch,
}: {
  isAdmin: boolean;
  active: ActiveStaff[];
  pending: PendingStaff[];
  availableBranches?: Array<{ id: string; name: string }>;
  currentBranch?: { id: string; name: string };
}) {
  const [busy, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const router = useRouter();
  const [local2fa, setLocal2fa] = useState<Record<string, string>>({});

  function handle2FaChange(staffId: string, val: string) {
    setLocal2fa((prev) => ({ ...prev, [staffId]: val }));
    startTransition(async () => {
      const res = await changeTwoFactorMethod(staffId, val);
      if (!res?.ok) {
        toast.error(res?.error || "Failed to update 2FA method");
        setLocal2fa((prev) => {
          const copy = { ...prev };
          delete copy[staffId];
          return copy;
        });
      } else {
        const label = val === "none" ? "disabled" : val === "totp" ? "Authenticator App" : "Email";
        toast.success(`2FA set to ${label}`);
        router.refresh();
      }
    });
  }

  // Combine active + pending into one list
  const allStaff = [
    ...active,
    ...pending.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.email.split("@")[0],
      email: p.email,
      role: p.role,
      departmentId: p.departmentId,
      departmentName: p.departmentName,
      joined: p.invited,
      self: false,
      status: "pending",
      modules: p.modules,
      twoFactorMethod: p.twoFactorMethod,
      assignedBranches: p.assignedBranches,
    })),
  ];

  const filtered = allStaff
    .filter((s) => {
      const q = search.toLowerCase();
      const matchesBranch =
        branchFilter === "all" ||
        (s.assignedBranches && s.assignedBranches.some((b) => b.id === branchFilter));
      return (
        (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) &&
        (roleFilter === "all" || s.role.toLowerCase() === roleFilter.toLowerCase()) &&
        (statusFilter === "all" || s.status === statusFilter) &&
        matchesBranch
      );
    })
    .sort((a, b) => {
      const r = a.name.localeCompare(b.name);
      return sortAsc ? r : -r;
    });

  const {
    paginatedItems: paginatedStaff,
    Pagination: staffPagination,
  } = useTablePagination({
    items: filtered,
    initialPageSize: 50,
  });

  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll  = () => setSelected(allChecked ? new Set() : new Set(filtered.map((s) => s.id)));
  const toggleOne  = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const hasActiveFilters = search !== "" || roleFilter !== "all" || statusFilter !== "all" || branchFilter !== "all";

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (showCreate || editingStaffId) {
    const editData = editingStaffId ? allStaff.find(s => s.id === editingStaffId) : undefined;
    return (
      <CreateStaffView
        onClose={() => { setShowCreate(false); setEditingStaffId(null); }}
        initialData={editData}
        availableBranches={availableBranches}
        currentBranch={currentBranch}
      />
    );
  }

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Staff Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage portal access, roles, and branch permissions.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4" />
              Create New Staff
            </button>
          )}
        </div>

        {/* Search + unified filters toolbar */}
        <div className="rounded-2xl bg-white p-3.5 shadow-sm border border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name or email..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-8 text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 focus:bg-white transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort button */}
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <span>{sortAsc ? "A–Z" : "Z–A"}</span>
            </button>

            {/* Branch Filter (if multiple branches available) */}
            {availableBranches.length > 1 && (
              <div className="relative">
                <Church className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-xs font-bold text-slate-700 outline-none hover:bg-slate-50 cursor-pointer transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <option value="all">All Branches</option>
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name.replace("World Ark Missions - ", "")}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            )}

            {/* Role Filter */}
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-xs font-bold text-slate-700 outline-none hover:bg-slate-50 cursor-pointer transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                <option value="all">All Roles</option>
                {Array.from(new Set([...DEFAULT_ROLES, ...active.map((s) => s.role)])).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-bold text-slate-700 outline-none hover:bg-slate-50 cursor-pointer transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setBranchFilter("all");
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                title="Reset all filters"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Staff Table Card */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-400">
                {hasActiveFilters
                  ? "No staff match your filters."
                  : "No staff yet. Click “+ Create New Staff” to add one."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="w-12 py-3.5 pl-5 pr-2">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 pr-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Staff Member
                    </th>
                    <th className="py-3.5 pr-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Branch Access
                    </th>
                    <th className="py-3.5 pr-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Role
                    </th>
                    <th className="py-3.5 pr-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      2FA
                    </th>
                    <th className="py-3.5 pr-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Status
                    </th>
                    <th className="py-3.5 pr-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Joined
                    </th>
                    <th className="py-3.5 pr-5 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStaff.map((s) => {
                    const effective2fa =
                      local2fa[s.id] ??
                      (s.twoFactorMethod === "auth_app" ? "totp" : s.twoFactorMethod || "none");

                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          className={cn(
                            "group transition-colors",
                            selected.has(s.id) ? "bg-blue-50/40" : "hover:bg-slate-50/70"
                          )}
                        >
                          {/* Checkbox */}
                          <td className="w-12 py-3.5 pl-5 pr-2">
                            <input
                              type="checkbox"
                              checked={selected.has(s.id)}
                              onChange={() => toggleOne(s.id)}
                              className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                            />
                          </td>

                          {/* Staff Member (Avatar + Name + Email) */}
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={s.name} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 leading-tight truncate">
                                    {s.name}
                                  </span>
                                  {s.self && (
                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{s.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Branch Access (Clean compact pills) */}
                          <td className="py-3.5 pr-4">
                            {s.assignedBranches && s.assignedBranches.length > 0 ? (
                              s.assignedBranches.length === availableBranches.length && availableBranches.length > 1 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50/80 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                  <Church className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                  <span>All Branches ({s.assignedBranches.length})</span>
                                </span>
                              ) : s.assignedBranches.length === 1 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                  <Church className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <span className="truncate max-w-[140px]">
                                    {s.assignedBranches[0].name.replace("World Ark Missions - ", "")}
                                  </span>
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200/60">
                                    <Church className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                    <span className="truncate max-w-[120px]">
                                      {s.assignedBranches[0].name.replace("World Ark Missions - ", "")}
                                    </span>
                                  </span>
                                  <span
                                    title={s.assignedBranches.map((b) => b.name.replace("World Ark Missions - ", "")).join(", ")}
                                    className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200/60 cursor-help"
                                  >
                                    +{s.assignedBranches.length - 1}
                                  </span>
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-slate-400 font-medium italic">Current branch</span>
                            )}
                          </td>

                          {/* Role / Access Level */}
                          <td className="py-3.5 pr-4">
                            <AccessBadge role={s.role} departmentName={s.departmentName} />
                          </td>

                          {/* 2FA Method Badge */}
                          <td className="py-3.5 pr-4">
                            <TwoFactorBadge method={effective2fa} />
                          </td>

                          {/* Status */}
                          <td className="py-3.5 pr-4">
                            <StatusBadge status={s.status} />
                          </td>

                          {/* Joined */}
                          <td className="py-3.5 pr-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                            {date(s.joined)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 pr-5 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              {/* 2FA Dropdown */}
                              {isAdmin && !s.self && (
                                <select
                                  value={effective2fa}
                                  disabled={busy}
                                  onChange={(e) => handle2FaChange(s.id, e.target.value)}
                                  className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer transition-all shadow-sm"
                                >
                                  <option value="none">No 2FA</option>
                                  <option value="email">Email</option>
                                  <option value="totp">Auth App</option>
                                </select>
                              )}

                              {/* 1-click quick Approve for pending accounts */}
                              {isAdmin && !s.self && s.status === "pending" && (
                                <button
                                  type="button"
                                  title="Approve staff account"
                                  disabled={busy}
                                  onClick={() => {
                                    startTransition(async () => {
                                      await updateStaffStatus(s.id, "active");
                                      router.refresh();
                                    });
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all shadow-sm"
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Approve</span>
                                </button>
                              )}

                              {/* Suspend or Reactivate */}
                              {isAdmin && !s.self && s.status === "active" && (
                                <button
                                  type="button"
                                  title="Suspend account"
                                  disabled={busy}
                                  onClick={() => {
                                    startTransition(async () => {
                                      await updateStaffStatus(s.id, "suspended");
                                      router.refresh();
                                    });
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 active:scale-95 transition-all shadow-sm"
                                >
                                  <Ban className="h-4 w-4" />
                                </button>
                              )}
                              {isAdmin && !s.self && s.status === "suspended" && (
                                <button
                                  type="button"
                                  title="Reactivate account"
                                  disabled={busy}
                                  onClick={() => {
                                    startTransition(async () => {
                                      await updateStaffStatus(s.id, "active");
                                      router.refresh();
                                    });
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 active:scale-95 transition-all shadow-sm"
                                >
                                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                                </button>
                              )}

                              {/* Resend credentials button (resets DB password & emails credentials) */}
                              {isAdmin && !s.self && (
                                <button
                                  type="button"
                                  title="Reset password to default (WAMCHURCH@26) and email login credentials"
                                  disabled={busy}
                                  onClick={() => {
                                    startTransition(async () => {
                                      toast.loading(`Resetting password and emailing credentials to ${s.email}...`, { id: `resend-${s.id}` });
                                      const res = await resendStaffCredentials(s.id);
                                      if (res?.ok) {
                                        toast.success(res.message || `Credentials sent to ${s.email}`, { id: `resend-${s.id}` });
                                      } else {
                                        toast.error(res?.error || "Failed to send credentials email", { id: `resend-${s.id}` });
                                      }
                                    });
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 active:scale-95 transition-all shadow-sm"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Edit button */}
                              <button
                                type="button"
                                title="Edit staff details"
                                onClick={() => setEditingStaffId(s.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all shadow-sm"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              {/* Module Permissions button (if non-admin) */}
                              {s.role.toLowerCase() !== "admin" && (
                                <button
                                  type="button"
                                  title={expandedId === s.id ? "Close module permissions" : "Manage module permissions"}
                                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                                  className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-lg border active:scale-95 transition-all shadow-sm",
                                    expandedId === s.id
                                      ? "bg-blue-50 border-blue-200 text-blue-600 ring-2 ring-blue-100"
                                      : "bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 hover:border-blue-200"
                                  )}
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Delete Staff button */}
                              {isAdmin && !s.self && (
                                <button
                                  type="button"
                                  title="Remove staff member"
                                  onClick={() => setPendingDeleteId(s.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition-all shadow-sm"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                      {/* Expanded module access drawer subrow */}
                      {expandedId === s.id && s.role.toLowerCase() !== "admin" && (
                        <tr key={`${s.id}-mod`} className="bg-slate-50/50">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                                    <Shield className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                      Module Permissions — {s.name}
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                      Configure sections this staff member is authorized to access
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(null)}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                  title="Close"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <ModuleToggles staff={s} disabled={!isAdmin || s.self} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bulk Selection Bar (only visible when rows are selected) */}
          {selected.size > 0 && (
            <div className="bg-blue-50/80 border-t border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-900">
                  {selected.size} staff member{selected.size > 1 ? "s" : ""} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Clear selection
                </button>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Tip: Manage individual staff members using their action buttons.
              </span>
            </div>
          )}

          {/* Unified Pagination */}
          {staffPagination}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title="Permanently Remove Staff?"
        description="This will permanently remove this staff member and revoke their access to the system. This action cannot be undone."
        confirmLabel="Permanently Remove"
        onConfirm={async () => { await removeStaff(pendingDeleteId!); }}
        successMessage="Staff member removed successfully."
        errorMessage="Failed to remove staff member."
      />
    </>
  );
}

/* Re-export so page.tsx can wire the button */
export function useCreateModal() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
