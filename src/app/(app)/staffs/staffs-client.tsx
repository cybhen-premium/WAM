"use client";

import React, { useState, useTransition, useActionState, useEffect } from "react";
import {
  ArrowLeft, ArrowUpDown, BanIcon, Check, CheckCircle, ChevronDown,
  Edit2, Eye, EyeOff, Filter, Plus, Search, Shield, Trash2, X, XCircle, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES, MODULE_KEYS } from "@/lib/modules";
import { changeTwoFactorMethod, createStaff, removeStaff, updateStaff, setStaffModules, updateStaffStatus } from "./actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTablePagination } from "@/components/table-pagination";

/** "John Doe" -> "johndoe" */
function toUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/* --- Types -------------------------------------------------------------- */

export type ActiveStaff = {
  id: string; name: string; email: string; role: string;
  joined: string; self: boolean; status: string; modules: string[];
  twoFactorMethod: string;
};
export type PendingStaff = {
  id: string; email: string; role: string; invited: string; modules: string[];
  twoFactorMethod: string;
};

const DEFAULT_ROLES = ["Admin", "Finance", "SOB", "Akwaaba"];
const DEFAULT_PASSWORD = "WAMCHURCH@26";

/* --- Module descriptions for the permissions step ----------------------- */
const MODULE_DESC: Record<string, string> = {
  dashboard:  "View church statistics, at-risk members, and celebration alerts.",
  members:    "Manage member profiles, departments, and categories.",
  akwaaba:    "Run the visitor welcome programme and reception intake.",
  sob:        "Track School of Baptism lesson progress for members.",
  tithes:     "Record and review weekly tithe contributions.",
  finances:   "Manage income, expenses, receipts, and financial reports.",
  analytics:  "View giving analytics, growth trends, and visitor conversion.",
  care:       "Manage pastoral welfare and dues.",
  messaging:  "Send SMS broadcasts, announcements, and AI-assisted sermons.",
  staffs:     "Manage staff accounts, roles, and module access.",
  settings:   "Configure church profile, branding, and integrations.",
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
function AccessBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700", pastor: "bg-blue-100 text-blue-700",
    finance: "bg-emerald-100 text-emerald-700", secretary: "bg-amber-100 text-amber-700",
    usher: "bg-slate-100 text-slate-600",
    sob: "bg-indigo-100 text-indigo-700", akwaaba: "bg-rose-100 text-rose-700"
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold capitalize", map[role?.toLowerCase()] ?? "bg-slate-100 text-slate-600")}>
      {role}
    </span>
  );
}
function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  const suspended = status === "suspended";
  
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", 
      active ? "text-emerald-600" : suspended ? "text-red-600" : "text-amber-600"
    )}>
      <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2", 
        active ? "border-emerald-500" : suspended ? "border-red-500" : "border-amber-400"
      )}>
        <span className={cn("h-1.5 w-1.5 rounded-full", 
          active ? "bg-emerald-500" : suspended ? "bg-red-500" : "bg-amber-400"
        )} />
      </span>
      {active ? "Active" : suspended ? "Suspended" : "Pending"}
    </span>
  );
}
function TwoFactorBadge({ method }: { method: string }) {
  const active = method !== "none";
  let displayMethod = method;
  if (method === "auth_app") displayMethod = "Auth App";

  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold capitalize border",
      active ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-slate-50 border-slate-100 text-slate-400"
    )}>
      {displayMethod}
    </span>
  );
}

/* --- Module toggles panel ------------------------------------------------ */
function ModuleToggles({ staff, disabled }: { staff: { id: string; modules: string[] }; disabled: boolean }) {
  const [busy, startTransition] = useTransition();
  const assigned = new Set(staff.modules);
  return (
    <div className="flex flex-wrap gap-1.5">
      {MODULE_KEYS.map((key) => {
        const on = assigned.has(key);
        return (
          <button key={key} type="button" disabled={disabled || busy} aria-pressed={on}
            onClick={() => {
              const next = on ? new Set([...assigned].filter((k) => k !== key)) : new Set([...assigned, key]);
              startTransition(() => setStaffModules(staff.id, [...next]));
            }}
            className={cn("rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all disabled:opacity-50",
              on ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
            {MODULES[key].label}
          </button>
        );
      })}
    </div>
  );
}

/* ===========================================================================
   CREATE / EDIT STAFF VIEW — 2-step wizard
=========================================================================== */
function CreateStaffView({ onClose, initialData }: { onClose: () => void, initialData?: ActiveStaff | PendingStaff }) {
  const isEditing = !!initialData;
  const [step, setStep] = useState<1 | 2>(1);
  const [showPass, setShowPass] = useState(false);
  const [fullName, setFullName] = useState((initialData as any)?.name || "");
  const [username, setUsername] = useState((initialData as any)?.name ? toUsername((initialData as any).name) : "");
  const [email, setEmail] = useState((initialData as any)?.email || "");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [role, setRole] = useState<string>(initialData?.role || "Akwaaba");
  const [activate, setActivate] = useState(!initialData || (initialData as ActiveStaff).status === "active");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(initialData?.modules || []));

  // Auto-generate username from full name
  useEffect(() => { 
    if (!isEditing || !username) setUsername(toUsername(fullName)); 
  }, [fullName, isEditing, username]);

  const [state, formAction, pending] = useActionState(isEditing ? updateStaff : createStaff, undefined);

  // Close on success
  useEffect(() => {
    if (state && "ok" in state && state.ok) onClose();
  }, [state, onClose]);

  function toggleModule(key: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function selectAll() { setSelectedModules(new Set(MODULE_KEYS)); }
  function clearAll() { setSelectedModules(new Set()); }

  const step1Valid = fullName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="w-full max-w-2xl mx-auto rounded-3xl bg-[#F5F7FB] shadow-md border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
      {/* -- Header -- */}
        <div className="flex items-center gap-4 px-8 pt-8 pb-2">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <div className="flex items-center gap-4 px-8 pb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            {isEditing ? "Edit Staff Account" : "New Staff Account"}
          </h2>
        </div>

        {/* -- Step tabs -- */}
        <div className="mx-6 mb-6 grid grid-cols-2 rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <button
            onClick={() => setStep(1)}
            className={cn("py-3.5 text-sm font-bold transition-all",
              step === 1 ? "bg-blue-50 text-blue-700" : "text-slate-400 hover:text-slate-600")}
          >
            1. Account Details
          </button>
          <button
            onClick={() => step1Valid && setStep(2)}
            disabled={!step1Valid}
            className={cn("py-3.5 text-sm font-bold transition-all",
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
          <input type="hidden" name="password" value={password} />
          <input type="hidden" name="role"     value={role} />
          {/* Temporary Password & Activate */}
          {!isEditing && activate && <input type="hidden" name="activate" value="on" />}
          {[...selectedModules].map((m) => (
            <input key={m} type="hidden" name="modules" value={m} />
          ))}

          {/* === STEP 1: Account Details === */}
          {step === 1 && (
            <div className="mx-6 mb-6 rounded-2xl bg-white border border-slate-100 p-6 space-y-5">

              {/* Full Name + Username */}
              <div className="grid grid-cols-2 gap-4">
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
                <span className="mb-1.5 block text-sm font-bold text-slate-700">Email Address <span className="text-red-500">*</span></span>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                />
              </label>

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
              )}

              {/* Error */}
              {state && "error" in state && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 border border-red-100">
                  {state.error}
                </p>
              )}

              {/* Activate + Next button */}
              <div className="flex items-center justify-between pt-2">
                {!isEditing ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button type="button" onClick={() => setActivate((v) => !v)}
                      className={cn("flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all",
                        activate ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white")}>
                      {activate && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </button>
                    <span className="text-sm font-semibold text-slate-700">Activate account immediately</span>
                  </label>
                ) : <div />}
                <button
                  type="button"
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next: Customize Permissions
                </button>
              </div>
            </div>
          )}

          {/* === STEP 2: Custom Permissions === */}
          {step === 2 && (
            <div className="mx-6 mb-6 rounded-2xl bg-white border border-slate-100 overflow-hidden">
              {/* Sub-header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                    <ArrowLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <div>
                    <p className="text-sm font-black text-slate-900">Custom Permissions</p>
                    <p className="text-xs text-slate-400">Override role defaults with specific permissions for this user</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={selectAll}
                    className="text-xs font-bold text-blue-600 hover:underline">Select All</button>
                  <span className="text-slate-300">·</span>
                  <button type="button" onClick={clearAll}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 hover:underline">Use Default</button>
                </div>
              </div>

              {/* Permission grid */}
              <div className="max-h-[380px] overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-3">
                  {MODULE_KEYS.map((key) => {
                    const on = selectedModules.has(key);
                    return (
                      <button
                        key={key} type="button" onClick={() => toggleModule(key)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-400 font-semibold">
                  {selectedModules.size} module{selectedModules.size !== 1 ? "s" : ""} selected
                  {role === "admin" && <span className="ml-1.5 text-purple-600">(admin gets all modules automatically)</span>}
                </p>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 transition-all"
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
  isAdmin, active, pending,
}: {
  isAdmin: boolean;
  active: ActiveStaff[];
  pending: PendingStaff[];
}) {
  const [busy, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Combine active + pending into one list
  const allStaff = [
    ...active,
    ...pending.map((p) => ({
      id: p.id, name: p.email.split("@")[0], email: p.email,
      role: p.role, joined: p.invited, self: false,
      status: "pending", modules: p.modules, twoFactorMethod: p.twoFactorMethod,
    })),
  ];

  const filtered = allStaff
    .filter((s) => {
      const q = search.toLowerCase();
      return (
        (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) &&
        (roleFilter === "all" || s.role === roleFilter) &&
        (statusFilter === "all" || s.status === statusFilter)
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

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (showCreate || editingStaffId) {
    const editData = editingStaffId ? allStaff.find(s => s.id === editingStaffId) : undefined;
    return <CreateStaffView onClose={() => { setShowCreate(false); setEditingStaffId(null); }} initialData={editData} />;
  }

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Staff Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage portal access, roles, and permissions.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4" />
              Create New
            </button>
          )}
        </div>

        {/* Search + filters */}
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
            </div>
            <button onClick={() => setSortAsc((v) => !v)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
              Sort {sortAsc ? "A–Z" : "Z–A"}
            </button>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-semibold text-slate-600 outline-none hover:bg-slate-50 cursor-pointer transition-all">
                <option value="all">All Roles</option>
                {Array.from(new Set([...DEFAULT_ROLES, ...active.map(s => s.role)])).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-8 text-sm font-semibold text-slate-600 outline-none hover:bg-slate-50 cursor-pointer transition-all">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-400">
                {search || roleFilter !== "all" || statusFilter !== "all"
                  ? "No staff match your filters."
                  : "No staff yet. Click \u201c+ Create New\u201d to add one."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="w-12 py-3 pl-5 pr-2">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer" />
                    </th>
                    {["Staff Info", "Access Level", "2FA", "Status", "Joined", "Actions"].map((h, i) => (
                      <th key={h} className={cn("py-3 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-400",
                        i === 5 ? "text-right pr-5" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedStaff.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr className={cn("group transition-colors", selected.has(s.id) ? "bg-blue-50/40" : "hover:bg-slate-50/60")}>
                        <td className="w-12 py-4 pl-5 pr-2">
                          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer" />
                        </td>

                        {/* Staff Info */}
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={s.name} />
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">
                                {s.name}
                                {s.self && <span className="ml-1.5 text-[10px] font-semibold text-slate-400">(you)</span>}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">{s.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Access Level */}
                        <td className="py-4 pr-4">
                          <AccessBadge role={s.role} />
                        </td>

                        {/* 2FA Method */}
                        <td className="py-4 pr-4">
                          <TwoFactorBadge method={s.twoFactorMethod} />
                        </td>

                        {/* Status */}
                        <td className="py-4 pr-4"><StatusBadge status={s.status} /></td>

                        {/* Joined */}
                        <td className="py-4 pr-4 text-sm text-slate-500">{date(s.joined)}</td>

                        {/* Actions */}
                        <td className="py-4 pr-5">
                          <div className="flex items-center justify-end gap-2">
                            {/* 2FA Dropdown */}
                            {isAdmin && !s.self && (
                              <select value={s.twoFactorMethod} disabled={busy}
                                onChange={(e) => startTransition(() => changeTwoFactorMethod(s.id, e.target.value))}
                                className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer transition-all">
                                <option value="none">No 2FA</option>
                                <option value="email">Email</option>
                                <option value="totp">Auth App</option>
                              </select>
                            )}
                            
                            {/* Suspend / Approve Buttons */}
                            {isAdmin && !s.self && s.status === "active" && (
                              <button type="button" title="Suspend"
                                onClick={() => startTransition(() => updateStaffStatus(s.id, "suspended"))}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-[#FFF0F0] px-2.5 py-1.5 text-[13px] font-bold text-[#1E293B] hover:bg-red-100 transition-colors">
                                <XCircle className="h-4 w-4 text-[#475569]" /> Suspend
                              </button>
                            )}
                            {isAdmin && !s.self && (s.status === "pending" || s.status === "suspended") && (
                              <button type="button" title={s.status === "suspended" ? "Unsuspend" : "Approve"}
                                onClick={() => startTransition(() => updateStaffStatus(s.id, "active"))}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[13px] font-bold text-[#064E3B] hover:bg-emerald-100 transition-colors">
                                <CheckCircle className="h-4 w-4 text-emerald-600" /> {s.status === "suspended" ? "Unsuspend" : "Approve"}
                              </button>
                            )}

                            {/* Shield (Modules) */}
                            {s.role.toLowerCase() !== "admin" && (
                              <button type="button" title="Module access"
                                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                                className={cn("rounded-lg border p-1.5 transition-colors",
                                  expandedId === s.id ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200")}>
                                <Shield className="h-4 w-4" />
                              </button>
                            )}

                            {/* Edit */}
                            <button type="button" title="Edit"
                              onClick={() => setEditingStaffId(s.id)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors">
                              <Edit2 className="h-4 w-4" />
                            </button>

                            {/* Delete */}
                            {isAdmin && !s.self && (
                              <button type="button" title="Remove"
                                onClick={() => setPendingDeleteId(s.id)}
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded module access */}
                      {expandedId === s.id && s.role !== "admin" && (
                        <tr key={`${s.id}-mod`}>
                          <td colSpan={7} className="px-5 pb-4 pt-0">
                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Shield className="h-4 w-4 text-blue-600" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                  Module Access — {s.name}
                                </p>
                              </div>
                              <ModuleToggles staff={s} disabled={!isAdmin || s.self} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {staffPagination}

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-semibold">
                {selected.size > 0
                  ? `${selected.size} of ${filtered.length} selected`
                  : `${filtered.length} staff member${filtered.length !== 1 ? "s" : ""}`}
              </p>
              {selected.size > 0 && isAdmin && (
                <button className="text-xs font-bold text-red-600 hover:underline">Remove selected</button>
              )}
            </div>
          )}
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
