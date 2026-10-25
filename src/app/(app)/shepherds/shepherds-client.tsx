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
  UserCheck,
  RotateCcw,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  createShepherd,
  updateShepherd,
  resetShepherdPassword,
  deleteShepherd,
  adminAssignDisciple,
  adminAssignDisciples,
  getShepherdFlockDetails,
  getAvailableCandidates,
} from "./actions";

type ShepherdItem = {
  id: string;
  staffId?: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  shepherdCode: string | null;
  active: boolean;
  notes: string | null;
  createdAt: Date;
  discipleCount: number;
  staffRole?: string | null;
  isUsingInitialPassword?: boolean;
};

export type StaffMemberItem = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: string;
};

type MemberCandidate = {
  id: string;
  fullName: string;
  phone: string | null;
  photoUrl?: string | null;
  category: string;
  fromAkwaaba: boolean | null;
  currentShepherdId?: string | null;
  currentShepherdName?: string | null;
};

export function ShepherdsClient({
  shepherds,
  allCandidates = [],
  staffMembers = [],
}: {
  shepherds: ShepherdItem[];
  allCandidates?: MemberCandidate[];
  staffMembers?: StaffMemberItem[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pending, startTransition] = useTransition();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSource, setCreateSource] = useState<"staff" | "new">("staff");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [editingShepherd, setEditingShepherd] = useState<ShepherdItem | null>(null);
  const [resetPasswordShepherd, setResetPasswordShepherd] = useState<ShepherdItem | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("WAM@2026");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [assigningShepherd, setAssigningShepherd] = useState<ShepherdItem | null>(null);

  // Flock inspection drawer / modal
  const [inspectingShepherd, setInspectingShepherd] = useState<ShepherdItem | null>(null);
  const [flockDetails, setFlockDetails] = useState<{
    disciples: any[];
    attendance: any[];
    spiritualLogs: any[];
  } | null>(null);
  const [loadingFlock, setLoadingFlock] = useState(false);

  // Candidate selection for assigning disciples (multi-select + tabs, loaded on-demand)
  const [candidates, setCandidates] = useState<MemberCandidate[]>(allCandidates);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateFilter, setCandidateFilter] = useState<"all" | "member" | "sob">("all");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  function handleOpenAssignModal(s: ShepherdItem) {
    setAssigningShepherd(s);
    setSelectedMemberIds([]);
    setCandidateSearch("");
    setCandidateFilter("all");
    if (candidates.length === 0) {
      setLoadingCandidates(true);
      startTransition(async () => {
        try {
          const list = await getAvailableCandidates();
          setCandidates(list);
        } catch {
          toast.error("Failed to load candidates list");
        } finally {
          setLoadingCandidates(false);
        }
      });
    }
  }

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
      setSelectedStaffId("");
      setStaffName("");
      setStaffEmail("");
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

  // Handle multi-disciple assignment
  function handleAssignDisciples(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningShepherd || selectedMemberIds.length === 0) {
      toast.error("Please select at least one member or SOB candidate.");
      return;
    }

    const payload = selectedMemberIds.map((id) => {
      const cand = candidates.find((c) => c.id === id);
      const isSob = cand?.category === "Regular Attendee" || cand?.fromAkwaaba;
      return { memberId: id, source: isSob ? "sob" : "member" };
    });

    startTransition(async () => {
      const res = await adminAssignDisciples(assigningShepherd.id, payload);
      if (!res.ok) {
        toast.error(res.error || "Failed to assign disciples.");
        return;
      }
      toast.success(
        `Assigned ${res.count || selectedMemberIds.length} disciple(s) to ${assigningShepherd.fullName}!`
      );
      setCandidates((prev) =>
        prev.map((c) =>
          selectedMemberIds.includes(c.id)
            ? {
                ...c,
                currentShepherdId: assigningShepherd.id,
                currentShepherdName: assigningShepherd.fullName,
              }
            : c
        )
      );
      setAssigningShepherd(null);
      setSelectedMemberIds([]);
      setCandidateSearch("");
    });
  }

  function toggleCandidate(id: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAllVisible() {
    const visibleIds = filteredCandidates.map((c) => c.id);
    setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  function clearSelection() {
    setSelectedMemberIds([]);
  }

  const sobCandidatesCount = useMemo(
    () => candidates.filter((c) => c.category === "Regular Attendee" || c.fromAkwaaba).length,
    [candidates]
  );
  const memberCandidatesCount = useMemo(
    () => candidates.filter((c) => c.category !== "Regular Attendee" && !c.fromAkwaaba).length,
    [candidates]
  );

  // Filter candidates for assignment
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const isSob = c.category === "Regular Attendee" || c.fromAkwaaba;
      if (candidateFilter === "sob" && !isSob) return false;
      if (candidateFilter === "member" && isSob) return false;

      if (!candidateSearch.trim()) return true;
      const q = candidateSearch.toLowerCase();
      return (
        c.fullName.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [candidates, candidateFilter, candidateSearch]);

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
                    <td
                      className="py-3.5 px-5 cursor-pointer group/shep"
                      onClick={() => handleInspectFlock(s)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#1e3a8a] to-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 group-hover/shep:scale-105 transition-transform shadow-2xs">
                          {s.fullName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-900 block group-hover/shep:text-[#1e3a8a] transition-colors">{s.fullName}</span>
                            {s.staffId ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9.5px] font-bold text-blue-700 border border-blue-200"
                                title="Linked to church staff account. Seamlessly accesses Shepherd Portal directly from sidebar."
                              >
                                <Sparkles className="h-2.5 w-2.5" /> Staff ({s.staffRole || "Member"}) • Sidebar Access
                              </span>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-500">
                                  Standalone
                                </span>
                                {s.isUsingInitialPassword ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-700 border border-amber-200"
                                    title="Using default initial password WAM@2026. Prompted to create own password upon portal login."
                                  >
                                    <KeyRound className="h-2.5 w-2.5" /> Initial Password (WAM@2026)
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 border border-emerald-200"
                                    title="Shepherd has created their own personal password."
                                  >
                                    Personal Password Set
                                  </span>
                                )}
                              </>
                            )}
                          </div>
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
                          onClick={() => handleOpenAssignModal(s)}
                          title="Assign Disciples"
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
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Register Shepherd</h3>
                <p className="text-xs text-slate-500">
                  Pick from church staff or register a new standalone shepherd.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateSource("staff");
                  setSelectedStaffId("");
                  setStaffName("");
                  setStaffEmail("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Source Switcher: Pick from Staff vs Create New */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setCreateSource("staff");
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  createSource === "staff"
                    ? "bg-white text-[#1e3a8a] shadow-xs font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Pick from Staff ({staffMembers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateSource("new");
                  setSelectedStaffId("");
                  setStaffName("");
                  setStaffEmail("");
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  createSource === "new"
                    ? "bg-white text-[#1e3a8a] shadow-xs font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create New Shepherd</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold">
              <input type="hidden" name="source" value={createSource} />
              <input type="hidden" name="staffId" value={selectedStaffId} />

              {createSource === "staff" && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100">
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">
                      Select Staff Member *
                    </label>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => {
                        const staffId = e.target.value;
                        setSelectedStaffId(staffId);
                        const selectedStaff = staffMembers.find((s) => s.id === staffId);
                        if (selectedStaff) {
                          setStaffName(selectedStaff.name || selectedStaff.email);
                          setStaffEmail(selectedStaff.email || "");
                        } else {
                          setStaffName("");
                          setStaffEmail("");
                        }
                      }}
                      required
                      className="w-full h-10 px-3 rounded-xl border border-blue-200 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Choose a staff member --</option>
                      {staffMembers.map((sm) => {
                        const alreadyAssigned = shepherds.some((s) => s.staffId === sm.id);
                        return (
                          <option key={sm.id} value={sm.id} disabled={alreadyAssigned}>
                            {sm.name || sm.email} ({sm.role}) {alreadyAssigned ? "— [Already Shepherd]" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex items-start gap-2.5 text-[11px] text-blue-900 bg-white/90 p-3 rounded-2xl border border-blue-200/80 shadow-2xs">
                    <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <strong className="block text-blue-950 font-black">Direct Sidebar Access (No Password Needed)</strong>
                      <span className="text-blue-800 leading-relaxed font-normal">
                        This staff member will not receive an initial password. The <strong>Shepherd Portal</strong> will be added directly to their church portal sidebar, accessed seamlessly with their existing staff credentials.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={createSource === "staff" ? staffName : undefined}
                  onChange={(e) => createSource === "staff" && setStaffName(e.target.value)}
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
                <p className="text-[10px] text-slate-400 mt-1">
                  Used for contact and discipleship notifications.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">
                  Email {createSource === "new" ? "(Optional)" : ""}
                </label>
                <input
                  type="email"
                  name="email"
                  value={createSource === "staff" ? staffEmail : undefined}
                  onChange={(e) => createSource === "staff" && setStaffEmail(e.target.value)}
                  placeholder="shepherd@example.com"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                />
              </div>

              {createSource === "new" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">Initial Password *</label>
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
                      Default: WAM@2026
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      name="password"
                      defaultValue="WAM@2026"
                      required
                      minLength={6}
                      placeholder="e.g. WAM@2026"
                      className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 bg-slate-50/70 font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60 mt-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Initial password is set to <strong>WAM@2026</strong>. When the shepherd signs in to the Shepherd Portal, they will be prompted to create their own personal password.
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 mb-1">Pastoral Notes (Optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Zone, cell group, or notes..."
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || (createSource === "staff" && !selectedStaffId)}
                  className="px-5 py-2 rounded-xl bg-[#1e3a8a] text-white font-bold shadow-md hover:bg-blue-900 transition-all cursor-pointer disabled:opacity-50"
                >
                  {pending
                    ? "Registering..."
                    : createSource === "staff"
                    ? "Assign Staff as Shepherd"
                    : "Register Shepherd"}
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

            {resetPasswordShepherd.staffId ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-blue-950">
                    <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Church Staff Account</span>
                  </div>
                  <p className="text-[11.5px] text-blue-800 leading-relaxed font-normal">
                    This shepherd is registered from the church staff. They access the <strong>Shepherd Portal</strong> directly from their main church portal sidebar using their staff credentials. No standalone shepherd password is required or used.
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPasswordShepherd(null)}
                    className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-semibold">
                <input type="hidden" name="id" value={resetPasswordShepherd.id} />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">New Password *</label>
                    <button
                      type="button"
                      onClick={() => setResetPasswordValue("WAM@2026")}
                      className="text-[11px] font-bold text-[#1e3a8a] hover:underline cursor-pointer"
                    >
                      Reset to WAM@2026
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      name="newPassword"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      required
                      minLength={6}
                      placeholder="e.g. WAM@2026"
                      className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 font-mono font-bold text-slate-800 bg-slate-50/70 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1">
                    <KeyRound className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      If reset to <strong>WAM@2026</strong>, the shepherd will be prompted to create their own personal password upon their next login.
                    </span>
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
            )}
          </div>
        </div>
      )}

      {/* -------------------------------- Modal: Assign Disciples to Shepherd -------------------------------- */}
      {assigningShepherd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-sm">
                  {assigningShepherd.fullName[0]}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Assign Disciples to Shepherd
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assigning to: <span className="font-bold text-slate-800">{assigningShepherd.fullName}</span>
                    {assigningShepherd.shepherdCode && ` (${assigningShepherd.shepherdCode})`}
                    {" "}• Current flock: <span className="font-semibold text-slate-700">{assigningShepherd.discipleCount}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssigningShepherd(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2.5">
              <button
                type="button"
                onClick={() => setCandidateFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  candidateFilter === "all"
                    ? "bg-[#1e3a8a] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Candidates ({candidates.length})
              </button>
              <button
                type="button"
                onClick={() => setCandidateFilter("member")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  candidateFilter === "member"
                    ? "bg-[#1e3a8a] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Church Members ({memberCandidatesCount})
              </button>
              <button
                type="button"
                onClick={() => setCandidateFilter("sob")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  candidateFilter === "sob"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >
                SOB Candidates ({sobCandidatesCount})
              </button>
            </div>

            {/* Search input & bulk action toolbar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search by candidate name, phone number, or category..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-semibold px-1 text-slate-500">
                <span>
                  Showing <strong className="text-slate-900">{filteredCandidates.length}</strong> candidate(s) •{" "}
                  <strong className="text-[#1e3a8a]">{selectedMemberIds.length}</strong> selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-xs font-bold text-[#1e3a8a] hover:underline cursor-pointer"
                  >
                    Select All Visible
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Candidate List (No limit, smooth scrolling) */}
            <form onSubmit={handleAssignDisciples} className="flex-1 flex flex-col min-h-0 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-1.5 border border-slate-200/80 rounded-2xl p-2 bg-slate-50/70 max-h-72">
                {loadingCandidates ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RotateCcw className="h-5 w-5 animate-spin text-[#1e3a8a]" />
                    <span className="text-xs font-semibold">Loading candidates...</span>
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">
                    No candidates found matching &ldquo;{candidateSearch}&rdquo;.
                  </p>
                ) : (
                  filteredCandidates.map((c) => {
                    const isSob = c.category === "Regular Attendee" || c.fromAkwaaba;
                    const isSelected = selectedMemberIds.includes(c.id);
                    const isAlreadyInThisFlock = c.currentShepherdId === assigningShepherd.id;

                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleCandidate(c.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-blue-50/90 border-blue-400 shadow-2xs"
                            : "bg-white hover:bg-slate-100/70 border-slate-200/60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCandidate(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded text-[#1e3a8a] border-slate-300 focus:ring-[#1e3a8a] cursor-pointer"
                          />
                          <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 overflow-hidden">
                            {c.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.photoUrl} alt={c.fullName} className="h-full w-full object-cover" />
                            ) : (
                              c.fullName[0]
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate">{c.fullName}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {c.phone || "No phone registered"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isAlreadyInThisFlock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              In this flock
                            </span>
                          ) : c.currentShepherdName ? (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/80 text-slate-700 max-w-[130px] truncate"
                              title={`Currently assigned to ${c.currentShepherdName}`}
                            >
                              Shepherd: {c.currentShepherdName}
                            </span>
                          ) : null}

                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isSob ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {isSob ? "SOB" : `Member • ${c.category}`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600">
                  {selectedMemberIds.length} disciple(s) selected
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssigningShepherd(null);
                      setSelectedMemberIds([]);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || selectedMemberIds.length === 0}
                    className="px-5 py-2 rounded-xl bg-[#1e3a8a] text-white text-xs font-bold shadow-md hover:bg-blue-900 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {pending
                      ? "Assigning Disciples..."
                      : `Assign ${selectedMemberIds.length > 0 ? selectedMemberIds.length : ""} Disciple${selectedMemberIds.length === 1 ? "" : "s"} to ${assigningShepherd.fullName}`}
                  </button>
                </div>
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
              <div className="py-16 flex flex-col items-center justify-center space-y-3 animate-in fade-in duration-150">
                <RotateCcw className="h-6 w-6 animate-spin text-[#1e3a8a]" />
                <p className="text-xs font-semibold text-slate-500">Loading flock overview &amp; attendance...</p>
              </div>
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
