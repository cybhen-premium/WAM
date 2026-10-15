"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormAction } from "@/components/use-form-action";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Trash2, Users, Mail, UserCheck, Eye, EyeOff, Check } from "lucide-react";
import { Modal, TextField, buttonStyles } from "@/components/ui";
import { DeleteButton } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  saveDepartment,
  deleteDepartment,
  assignDepartmentAccount,
  removeDepartmentAccount,
  resendDepartmentCredentials,
} from "./actions";

export type DepartmentLeader = {
  id: string;
  name: string | null;
  email: string;
};

export type StaffOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

/* Header buttons ----------------------------------------------------------- */

export function DepartmentToolbar() {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full lg:w-auto">
      <button onClick={() => setAdding(true)} className={`${buttonStyles.primary} w-full sm:w-auto`}>
        <Plus /> Add Department
      </button>

      <DepartmentFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function DepartmentRowActions({
  department,
  assignedLeader,
  availableStaff = [],
  isAdmin,
}: {
  department: { id: string; name: string };
  assignedLeader?: DepartmentLeader;
  availableStaff?: StaffOption[];
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [managingAccount, setManagingAccount] = useState(false);
  const [resending, startTransition] = useTransition();

  const handleQuickResend = () => {
    if (!assignedLeader) return;
    startTransition(async () => {
      const res = await resendDepartmentCredentials(department.id);
      if (res?.ok) {
        toast.success(res.message || `Credentials sent to ${assignedLeader.email}`);
      } else {
        toast.error(res?.error || "Failed to resend credentials.");
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-1">
      {isAdmin && (
        <>
          <button
            onClick={() => setManagingAccount(true)}
            className={buttonStyles.ghost}
            title={assignedLeader ? "Manage Department Leader Login" : "Assign Department Leader Login"}
            aria-label="Manage Department Leader Login"
          >
            <KeyRound className={assignedLeader ? "text-emerald-600" : "text-amber-500"} />
          </button>

          {assignedLeader && (
            <button
              onClick={handleQuickResend}
              disabled={resending}
              className={buttonStyles.ghost}
              title={`Resend Login Link & Password to ${assignedLeader.email}`}
              aria-label="Resend Credentials"
            >
              <Mail className="h-4 w-4 text-blue-600 hover:text-blue-700" />
            </button>
          )}
        </>
      )}
      <button onClick={() => setEditing(true)} className={buttonStyles.ghost} title="Edit" aria-label="Edit">
        <Pencil />
      </button>
      <DeleteButton action={async () => deleteDepartment(department.id)} />
      <DepartmentFormModal open={editing} onClose={() => setEditing(false)} department={department} />
      <DepartmentAccountModal
        open={managingAccount}
        onClose={() => setManagingAccount(false)}
        department={department}
        assignedLeader={assignedLeader}
        availableStaff={availableStaff}
      />
    </div>
  );
}

/* Add / edit department form ----------------------------------------------- */

function DepartmentFormModal({
  open,
  onClose,
  department,
}: {
  open: boolean;
  onClose: () => void;
  department?: { id: string; name: string };
}) {
  const [state, action, pending] = useFormAction(saveDepartment, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={department ? "Edit Department" : "New Department"}
      subtitle="Church Administration"
      icon={Users}
      compact
    >
      <form action={action} className="space-y-5 pb-2 text-left">
        {department && <input type="hidden" name="id" value={department.id} />}

        <TextField
          label="Department Name"
          name="name"
          required
          placeholder="e.g. Women of Grace"
          defaultValue={department?.name ?? ""}
        />

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Saving…" : department ? "Save Changes" : "Create Department"}
        </button>
      </form>
    </Modal>
  );
}

/* Assign / edit department login account modal ---------------------------- */

function DepartmentAccountModal({
  open,
  onClose,
  department,
  assignedLeader,
  availableStaff = [],
}: {
  open: boolean;
  onClose: () => void;
  department: { id: string; name: string };
  assignedLeader?: DepartmentLeader;
  availableStaff?: StaffOption[];
}) {
  const [state, action, pending] = useFormAction(assignDepartmentAccount, () => {
    toast.success("Department leader login saved and credentials emailed!");
    onClose();
  });
  const [removing, setRemoving] = useState(false);
  const [resending, setResending] = useState(false);

  const [mode, setMode] = useState<"pick" | "new">("new");
  const [leaderName, setLeaderName] = useState("");
  const [leaderEmail, setLeaderEmail] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [customPassword, setCustomPassword] = useState("WAMCHURCH@26");

  // Sync state whenever the modal opens or the department/leader changes
  useEffect(() => {
    if (open) {
      setLeaderName(assignedLeader?.name ?? "");
      setLeaderEmail(assignedLeader?.email ?? "");
      setSelectedStaffId("");
      setShowPassword(false);
      setCustomPassword(assignedLeader ? "" : "WAMCHURCH@26");
      setMode(availableStaff.length > 0 && !assignedLeader ? "pick" : "new");
    }
  }, [open, assignedLeader, availableStaff.length]);

  const handlePickStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    const s = availableStaff.find((x) => x.id === staffId);
    if (s) {
      setLeaderName(s.name ?? s.email.split("@")[0]);
      setLeaderEmail(s.email);
    } else {
      setLeaderName("");
      setLeaderEmail("");
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove the leader login assignment for ${department.name}?`)) return;
    setRemoving(true);
    try {
      await removeDepartmentAccount(department.id);
      toast.success("Department leader assignment removed.");
      onClose();
    } catch {
      toast.error("Failed to remove leader assignment.");
    } finally {
      setRemoving(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await resendDepartmentCredentials(department.id);
      if (res?.ok) {
        toast.success(res.message || "Credentials emailed to leader!");
      } else {
        toast.error(res?.error || "Failed to resend credentials.");
      }
    } catch {
      toast.error("Failed to send credentials.");
    } finally {
      setResending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${department.name} Leader`}
      subtitle="Department Portal Access"
      icon={KeyRound}
    >
      <form action={action} className="space-y-4 text-left">
        <input type="hidden" name="departmentId" value={department.id} />

        {/* --- SCENARIO 1: LEADER ALREADY ASSIGNED --- */}
        {assignedLeader ? (
          <div className="space-y-4">
            {/* Hidden fields for server action */}
            <input type="hidden" name="name" value={leaderName || assignedLeader.name || ""} />
            <input type="hidden" name="email" value={leaderEmail || assignedLeader.email} />

            {/* Active Leader Profile Card */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg shadow-sm">
                  {(leaderName || assignedLeader.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm md:text-base font-black text-slate-900 truncate">
                      {leaderName || assignedLeader.name || "Department Leader"}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    {assignedLeader.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Optional Password Update */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Update Password <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Leave blank to keep existing password"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {state?.error && <p className="text-xs font-semibold text-rose-600">{state.error}</p>}

            {/* Actions Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={resending || pending || removing}
                onClick={handleResend}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 h-11 text-xs font-bold text-blue-700 hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                title="Resend login link & password to leader's email"
              >
                <Mail className="h-4 w-4" />
                <span>{resending ? "Sending…" : "Resend Credentials"}</span>
              </button>

              {customPassword ? (
                <button
                  type="submit"
                  disabled={pending || removing || resending}
                  className="inline-flex items-center justify-center flex-1 h-11 rounded-xl bg-[#1e3a8a] text-white hover:bg-blue-900 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  {pending ? "Saving…" : "Save New Password"}
                </button>
              ) : null}

              <button
                type="button"
                disabled={removing || pending || resending}
                onClick={handleRemove}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 h-11 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                title="Unassign leader from this department"
              >
                <Trash2 className="h-4 w-4" />
                <span>{removing ? "Removing…" : "Unassign Leader"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* --- SCENARIO 2: ASSIGNING A NEW LEADER --- */
          <div className="space-y-4">
            {/* Clean Segmented Tab Switcher */}
            {availableStaff.length > 0 && (
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setMode("pick");
                    setLeaderName("");
                    setLeaderEmail("");
                    setSelectedStaffId("");
                  }}
                  className={cn(
                    "py-2 rounded-lg transition-all",
                    mode === "pick"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Select Church Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("new");
                    setSelectedStaffId("");
                  }}
                  className={cn(
                    "py-2 rounded-lg transition-all",
                    mode === "new"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  New Leader Account
                </button>
              </div>
            )}

            {/* Mode A: Quick Pick from Existing Staff */}
            {mode === "pick" && availableStaff.length > 0 ? (
              <div className="space-y-3">
                <input type="hidden" name="name" value={leaderName} />
                <input type="hidden" name="email" value={leaderEmail} />

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Staff Member
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => handlePickStaff(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                  >
                    <option value="">-- Choose a staff member --</option>
                    {availableStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.email} · {s.role} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedStaffId && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs">
                        {(leaderName || "S").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">{leaderName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{leaderEmail}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 shrink-0">
                      <UserCheck className="h-3 w-3" /> Ready
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Mode B: Direct New Leader Entry */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      placeholder="e.g. Kwame Mensah"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Personal Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={leaderEmail}
                      onChange={(e) => setLeaderEmail(e.target.value)}
                      placeholder="e.g. kwame@gmail.com"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="WAMCHURCH@26"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Clean Notice */}
            <div className="flex items-center gap-2.5 rounded-xl bg-blue-50/80 border border-blue-100/80 p-3 text-xs text-blue-900 font-medium">
              <Mail className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Login URL and credentials will be sent to this personal email.</span>
            </div>

            {state?.error && <p className="text-xs font-semibold text-rose-600">{state.error}</p>}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={pending || !leaderEmail || !leaderName}
                className="w-full h-11 rounded-xl bg-[#1e3a8a] text-white hover:bg-blue-900 text-xs font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {pending ? "Assigning Leader…" : "Assign Leader & Send Login"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
