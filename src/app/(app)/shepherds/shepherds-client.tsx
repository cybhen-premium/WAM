"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  CalendarCheck,
  Heart,
  KeyRound,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  BookOpen,
  Flame,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  createShepherd,
  updateShepherd,
  resetShepherdPassword,
  deleteShepherd,
  adminAssignDisciple,
  getShepherdFlockDetails,
} from "./actions";

type ShepherdItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  shepherdCode: string | null;
  active: boolean;
  notes: string | null;
  createdAt: Date;
  discipleCount: number;
};

type MemberCandidate = {
  id: string;
  fullName: string;
  phone: string | null;
  category: string;
  fromAkwaaba: boolean | null;
};

export function ShepherdsClient({
  shepherds,
  allCandidates,
}: {
  shepherds: ShepherdItem[];
  allCandidates: MemberCandidate[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pending, startTransition] = useTransition();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingShepherd, setEditingShepherd] = useState<ShepherdItem | null>(null);
  const [resetPasswordShepherd, setResetPasswordShepherd] = useState<ShepherdItem | null>(null);
  const [assigningShepherd, setAssigningShepherd] = useState<ShepherdItem | null>(null);

  // Flock inspection drawer / modal
  const [inspectingShepherd, setInspectingShepherd] = useState<ShepherdItem | null>(null);
  const [flockDetails, setFlockDetails] = useState<{
    disciples: any[];
    attendance: any[];
    spiritualLogs: any[];
  } | null>(null);
  const [loadingFlock, setLoadingFlock] = useState(false);

  // Candidate selection for assigning disciple
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");

  // Filtered shepherds
  const filteredShepherds = shepherds.filter((s) => {
    if (statusFilter === "active" && !s.active) return false;
    if (statusFilter === "inactive" && s.active) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      (s.shepherdCode && s.shepherdCode.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  // Overview metrics
  const totalDisciples = useMemo(
    () => shepherds.reduce((acc, s) => acc + s.discipleCount, 0),
    [shepherds]
  );
  const activeShepherdsCount = useMemo(
    () => shepherds.filter((s) => s.active).length,
    [shepherds]
  );

  // Load flock details
  function handleInspectFlock(shepherd: ShepherdItem) {
    setInspectingShepherd(shepherd);
    setLoadingFlock(true);
    startTransition(async () => {
      const details = await getShepherdFlockDetails(shepherd.id);
      setFlockDetails(details);
      setLoadingFlock(false);
    });
  }

  // Handle form submissions
  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createShepherd(undefined, formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Shepherd registered successfully!");
      setIsCreateOpen(false);
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateShepherd(undefined, formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Shepherd profile updated!");
      setEditingShepherd(null);
    });
  }

  function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await resetShepherdPassword(undefined, formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Password reset successfully! Previous sessions revoked.");
      setResetPasswordShepherd(null);
    });
  }

  function handleDelete(shepherd: ShepherdItem) {
    if (!confirm(`Are you sure you want to delete shepherd "${shepherd.fullName}"? All flock assignments will be removed.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteShepherd(shepherd.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Shepherd deleted.");
    });
  }

  function handleAssignDisciple(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningShepherd || !selectedMemberId) {
      toast.error("Please select a member or SOB candidate.");
      return;
    }
    const cand = allCandidates.find((c) => c.id === selectedMemberId);
    const isSob = cand?.category === "Regular Attendee" || cand?.fromAkwaaba;

    startTransition(async () => {
      const res = await adminAssignDisciple(
        assigningShepherd.id,
        selectedMemberId,
        isSob ? "sob" : "member"
      );
      if (!res.ok) {
        toast.error(res.error || "Failed to assign disciple.");
        return;
      }
      toast.success(`Disciple assigned to ${assigningShepherd.fullName}!`);
      setAssigningShepherd(null);
      setSelectedMemberId("");
    });
  }

  // Filter candidates for assignment
  const filteredCandidates = allCandidates.filter((c) => {
    if (!candidateSearch.trim()) return true;
    const q = candidateSearch.toLowerCase();
    return c.fullName.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center shrink-0">
              <Compass className="h-5 w-5 text-[#1e3a8a]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Shepherds &amp; Disciples
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Flock management, service attendance registers, and spiritual life evaluations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Link
            href="/shepherd/login"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            <span>Shepherd Portal Login</span>
          </Link>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-blue-900 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Register Shepherd</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Shepherds
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center">
              <Compass className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900">{shepherds.length}</span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-1">
            {activeShepherdsCount} active in church
          </span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Disciples
            </span>
            <div className="h-8 w-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-green-700">{totalDisciples}</span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-1">
            Under active pastoral care
          </span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Average Flock Size
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900">
            {shepherds.length > 0 ? (totalDisciples / shepherds.length).toFixed(1) : 0}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-1">
            Disciples per shepherd
          </span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Spiritual System
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Heart className="h-4 w-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-purple-700">Active</span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-1">
            Quiet time &amp; prayer logs
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by shepherd name, phone, code..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          {(["all", "active", "inactive"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                statusFilter === status
                  ? "bg-[#1e3a8a] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Shepherds Table */}
      <div className="rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Shepherd</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Flock Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShepherds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                    No shepherds registered or matching criteria.
                  </td>
                </tr>
              ) : (
                filteredShepherds.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#1e3a8a] to-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {s.fullName[0]}
                        </div>
                        <div>
                          <span className="font-black text-slate-900 block">{s.fullName}</span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#1e3a8a] mt-0.5">
                            {s.shepherdCode || "SHP-ID"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                      <div className="space-y-0.5">
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" /> {s.phone}
                        </p>
                        {s.email && (
                          <p className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Mail className="h-3 w-3 text-slate-400" /> {s.email}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleInspectFlock(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#1e3a8a] text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>{s.discipleCount} Disciples</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          s.active
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleInspectFlock(s)}
                          title="Inspect Flock & Attendance"
                          className="h-8 w-8 rounded-lg text-slate-600 hover:text-[#1e3a8a] hover:bg-slate-100 flex items-center justify-center transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            setAssigningShepherd(s);
                            setSelectedMemberId("");
                            setCandidateSearch("");
                          }}
                          title="Assign Disciple"
                          className="h-8 w-8 rounded-lg text-slate-600 hover:text-green-600 hover:bg-green-50 flex items-center justify-center transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => setEditingShepherd(s)}
                          title="Edit Shepherd"
                          className="h-8 w-8 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => setResetPasswordShepherd(s)}
                          title="Reset Password"
                          className="h-8 w-8 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center transition-colors"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(s)}
                          title="Delete Shepherd"
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------- Modal: Register New Shepherd -------------------------------- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Register New Shepherd</h3>
                <p className="text-xs text-slate-500">
                  Separate from staff. Dedicated access to shepherd portal.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Bro. Emmanuel Mensah"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="024XXXXXXX"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  name="email"
                  placeholder="shepherd@example.com"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Pastoral Notes (Optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Zone, cell group, or notes..."
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 rounded-xl bg-[#1e3a8a] text-white font-bold shadow-md hover:bg-blue-900 transition-all cursor-pointer"
                >
                  {pending ? "Registering..." : "Register Shepherd"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------- Modal: Edit Shepherd -------------------------------- */}
      {editingShepherd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Edit Shepherd Profile</h3>
              <button
                onClick={() => setEditingShepherd(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs font-semibold">
              <input type="hidden" name="id" value={editingShepherd.id} />

              <div>
                <label className="block text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  defaultValue={editingShepherd.fullName}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingShepherd.phone}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingShepherd.email || ""}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Status</label>
                <select
                  name="active"
                  defaultValue={editingShepherd.active ? "true" : "false"}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive / Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingShepherd.notes || ""}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingShepherd(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 rounded-xl bg-[#1e3a8a] text-white font-bold shadow-md hover:bg-blue-900 transition-all cursor-pointer"
                >
                  {pending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------- Modal: Reset Shepherd Password -------------------------------- */}
      {resetPasswordShepherd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Reset Shepherd Password</h3>
                <p className="text-xs text-slate-500">{resetPasswordShepherd.fullName}</p>
              </div>
              <button
                onClick={() => setResetPasswordShepherd(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-semibold">
              <input type="hidden" name="id" value={resetPasswordShepherd.id} />

              <div>
                <label className="block text-slate-700 mb-1">New Password *</label>
                <input
                  type="password"
                  name="newPassword"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordShepherd(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold shadow-md hover:bg-amber-700 transition-all cursor-pointer"
                >
                  {pending ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------- Modal: Assign Disciple to Shepherd -------------------------------- */}
      {assigningShepherd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Assign Disciple</h3>
                <p className="text-xs text-slate-500">
                  Assign to: <span className="font-bold text-slate-800">{assigningShepherd.fullName}</span>
                </p>
              </div>
              <button
                onClick={() => setAssigningShepherd(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignDisciple} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Search Candidates</label>
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50">
                {filteredCandidates.slice(0, 30).map((c) => {
                  const isSob = c.category === "Regular Attendee" || c.fromAkwaaba;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        selectedMemberId === c.id
                          ? "bg-blue-100/70 border border-blue-300"
                          : "hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="selectedCandidate"
                          value={c.id}
                          checked={selectedMemberId === c.id}
                          onChange={() => setSelectedMemberId(c.id)}
                        />
                        <span className="text-xs font-bold text-slate-900">{c.fullName}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSob ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>
                        {isSob ? "SOB" : "Member"}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningShepherd(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !selectedMemberId}
                  className="px-5 py-2 rounded-xl bg-[#1e3a8a] text-white font-bold shadow-md hover:bg-blue-900 transition-all cursor-pointer disabled:opacity-50"
                >
                  {pending ? "Assigning..." : "Assign to Shepherd"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------- Modal: Inspect Shepherd Flock & Details -------------------------------- */}
      {inspectingShepherd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#1e3a8a] to-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  {inspectingShepherd.fullName[0]}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {inspectingShepherd.fullName} • Discipleship Flock
                  </h3>
                  <p className="text-xs text-slate-500">
                    Code: <span className="font-mono font-bold text-slate-800">{inspectingShepherd.shepherdCode || "N/A"}</span> • Phone: {inspectingShepherd.phone}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setInspectingShepherd(null);
                  setFlockDetails(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {loadingFlock ? (
              <p className="text-center py-12 text-xs text-slate-400">Loading flock overview...</p>
            ) : !flockDetails || flockDetails.disciples.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No disciples assigned to this shepherd yet.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Disciples in this flock */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Assigned Disciples ({flockDetails.disciples.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {flockDetails.disciples.map(({ disciple, member }: any) => (
                      <div
                        key={disciple.id}
                        className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-xl bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 overflow-hidden shrink-0">
                            {member.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={member.photoUrl} alt={member.fullName} className="h-full w-full object-cover" />
                            ) : (
                              member.fullName[0]
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{member.fullName}</p>
                            <p className="text-[10px] text-slate-400">{member.phone || "No phone"}</p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${disciple.source === "sob" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                          {disciple.source === "sob" ? "SOB" : "Member"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Service Attendance */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Recent Service Attendance Records
                  </h4>
                  {flockDetails.attendance.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No service attendance recorded by this shepherd yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Service</th>
                            <th className="py-2.5 px-3">Disciple</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {flockDetails.attendance.slice(0, 10).map((a: any) => (
                            <tr key={a.att.id}>
                              <td className="py-2 px-3 font-mono text-slate-500">{a.att.serviceDate}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">
                                {a.att.serviceType === "Custom" ? a.att.customProgramName : a.att.serviceType}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{a.memberName}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  a.att.status === "Present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {a.att.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recent Spiritual Walk Evaluations */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Recent Spiritual Walk Evaluations
                  </h4>
                  {flockDetails.spiritualLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No spiritual evaluations logged yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {flockDetails.spiritualLogs.slice(0, 5).map((l: any) => (
                        <div key={l.log.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{l.memberName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{l.log.logDate}</span>
                          </div>
                          <p className="text-slate-600">
                            Quiet Time: <span className="font-semibold">{l.log.quietTimeConsistency}</span> • Prayer: <span className="font-semibold">{l.log.prayerLifeRating}</span>
                          </p>
                          {l.log.shepherdRemarks && (
                            <p className="text-slate-500 italic text-[11px]">
                              Guidance: &ldquo;{l.log.shepherdRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
