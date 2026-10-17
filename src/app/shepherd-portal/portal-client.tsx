"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  Users,
  CalendarCheck,
  Heart,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Phone,
  LogOut,
  UserCheck,
  FileText,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Filter,
  Flame,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  logoutShepherd,
  searchAvailableDisciples,
  addDiscipleToFlock,
  addDisciplesToFlock,
  removeDiscipleFromFlock,
  recordServiceAttendance,
  recordSpiritualEvaluation,
} from "./actions";

type DiscipleRow = {
  disciple: {
    id: string;
    source: string;
    assignedAt: string | null;
    notes: string | null;
  };
  member: {
    id: string;
    fullName: string;
    phone: string | null;
    photoUrl: string | null;
    category: string;
    gender: string | null;
    fromAkwaaba: boolean | null;
  };
};

type AttendanceRow = {
  att: {
    id: string;
    serviceDate: string;
    serviceType: string;
    customProgramName: string | null;
    status: string;
    notes: string | null;
    memberId: string;
  };
  memberName: string;
};

type SpiritualLogRow = {
  log: {
    id: string;
    memberId: string;
    logDate: string;
    quietTimeConsistency: string;
    quietTimeScripture: string | null;
    prayerLifeRating: string;
    prayerFocusNotes: string | null;
    spiritualStatus: string;
    shepherdRemarks: string | null;
  };
  memberName: string;
};

export function ShepherdPortalClient({
  shepherd,
  church,
  disciples,
  recentAttendance,
  recentSpiritualLogs,
}: {
  shepherd: {
    id: string;
    fullName: string;
    phone: string;
    shepherdCode: string | null;
    email: string | null;
    photoUrl: string | null;
  };
  church: {
    name: string;
    logoUrl: string | null;
  };
  disciples: DiscipleRow[];
  recentAttendance: AttendanceRow[];
  recentSpiritualLogs: SpiritualLogRow[];
}) {
  const [activeTab, setActiveTab] = useState<"disciples" | "attendance" | "spiritual">("disciples");
  const [searchTerm, setSearchTerm] = useState("");
  const [pending, startTransition] = useTransition();

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSourceFilter, setCandidateSourceFilter] = useState<"all" | "member" | "sob">("all");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  // Single attendance modal
  const [selectedMemberForAttendance, setSelectedMemberForAttendance] = useState<DiscipleRow["member"] | null>(null);

  // Spiritual modal
  const [selectedMemberForSpiritual, setSelectedMemberForSpiritual] = useState<DiscipleRow["member"] | null>(null);

  // Bulk register state
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState<string>("Sunday Service");
  const [customProgramName, setCustomProgramName] = useState("");
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, "Present" | "Absent" | "Late" | "Excused">>({});
  const [attendanceNotes, setAttendanceNotes] = useState<Record<string, string>>({});

  // Initialize bulk attendance statuses
  useMemo(() => {
    const initial: Record<string, "Present" | "Absent" | "Late" | "Excused"> = {};
    for (const d of disciples) {
      if (!attendanceStatuses[d.member.id]) {
        initial[d.member.id] = "Present";
      }
    }
    if (Object.keys(initial).length > 0) {
      setAttendanceStatuses((prev) => ({ ...initial, ...prev }));
    }
  }, [disciples]);

  // Filtered disciples
  const filteredDisciples = disciples.filter((d) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      d.member.fullName.toLowerCase().includes(q) ||
      (d.member.phone && d.member.phone.includes(q)) ||
      d.member.category.toLowerCase().includes(q)
    );
  });

  // Calculate spiritual status summary
  const latestStatusByMember = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of recentSpiritualLogs) {
      if (!map.has(l.log.memberId)) {
        map.set(l.log.memberId, l.log.spiritualStatus);
      }
    }
    return map;
  }, [recentSpiritualLogs]);

  // Calculate attendance count
  const attendanceCountByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of recentAttendance) {
      if (a.att.status === "Present" || a.att.status === "Late") {
        map.set(a.att.memberId, (map.get(a.att.memberId) ?? 0) + 1);
      }
    }
    return map;
  }, [recentAttendance]);

  // Search candidates for adding disciple
  function handleCandidateSearch(q: string) {
    setCandidateSearch(q);
    setSearchingCandidates(true);
    startTransition(async () => {
      const results = await searchAvailableDisciples(q);
      setCandidates(results);
      setSearchingCandidates(false);
    });
  }

  function toggleSelectCandidate(id: string) {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAllVisibleCandidates() {
    const visibleIds = filteredCandidates.map((c) => c.id);
    setSelectedCandidateIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  function clearCandidateSelection() {
    setSelectedCandidateIds([]);
  }

  // Handle adding single disciple
  function handleAddDisciple(memberId: string, source: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("memberId", memberId);
      formData.set("source", source);
      const res = await addDiscipleToFlock(formData);
      if (!res.ok) {
        toast.error(res.error || "Failed to add disciple.");
        return;
      }
      toast.success("Disciple added to your flock successfully!");
      setIsAddModalOpen(false);
      setSelectedCandidateIds([]);
      setCandidateSearch("");
      setCandidates([]);
    });
  }

  // Handle adding multiple selected disciples
  function handleAddSelectedDisciples() {
    if (selectedCandidateIds.length === 0) {
      toast.error("Please select at least one candidate.");
      return;
    }
    const payload = selectedCandidateIds.map((id) => {
      const cand = candidates.find((c) => c.id === id);
      return { memberId: id, source: cand?.source || "member" };
    });

    startTransition(async () => {
      const res = await addDisciplesToFlock(payload);
      if (!res.ok) {
        toast.error(res.error || "Failed to add disciples.");
        return;
      }
      toast.success(`Added ${res.count || selectedCandidateIds.length} disciple(s) to your flock!`);
      setIsAddModalOpen(false);
      setSelectedCandidateIds([]);
      setCandidateSearch("");
      setCandidates([]);
    });
  }

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (candidateSourceFilter === "sob" && c.source !== "sob") return false;
      if (candidateSourceFilter === "member" && c.source !== "member") return false;
      return true;
    });
  }, [candidates, candidateSourceFilter]);

  const sobCount = useMemo(() => candidates.filter((c) => c.source === "sob").length, [candidates]);
  const memberCount = useMemo(() => candidates.filter((c) => c.source === "member").length, [candidates]);

  // Handle remove disciple
  function handleRemoveDisciple(discipleId: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name} from your flock?`)) return;
    startTransition(async () => {
      const res = await removeDiscipleFromFlock(discipleId);
      if (!res.ok) {
        toast.error(res.error || "Failed to remove disciple.");
        return;
      }
      toast.success(`${name} has been removed from your flock.`);
    });
  }

  // Handle bulk attendance submission
  function handleSaveBulkAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (disciples.length === 0) {
      toast.error("You don't have any disciples assigned yet.");
      return;
    }

    const payload = disciples.map((d) => ({
      memberId: d.member.id,
      status: attendanceStatuses[d.member.id] || "Present",
      notes: attendanceNotes[d.member.id] || "",
    }));

    startTransition(async () => {
      const res = await recordServiceAttendance(
        serviceDate,
        serviceType,
        serviceType === "Custom" ? customProgramName : null,
        payload
      );
      if (!res.ok) {
        toast.error(res.error || "Failed to record attendance.");
        return;
      }
      toast.success(`Service attendance saved for ${disciples.length} disciples!`);
    });
  }

  // Handle spiritual check-in submission
  function handleSaveSpiritual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordSpiritualEvaluation(formData);
      if (!res.ok) {
        toast.error(res.error || "Failed to save evaluation.");
        return;
      }
      toast.success("Spiritual walk evaluation recorded!");
      setSelectedMemberForSpiritual(null);
    });
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center p-1 shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={church.logoUrl || "https://res.cloudinary.com/dm5bp1efp/image/upload/v1792173363/churchy/branding/noka8l1kbu6jz0zuzrva.png"}
                alt={church.name}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  {church.name}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#1e3a8a] border border-blue-100">
                  <Compass className="h-3 w-3" /> Shepherd Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold truncate">
                Discipleship &amp; Pastoral Care
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-black text-slate-800">{shepherd.fullName}</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                {shepherd.shepherdCode || shepherd.phone}
              </span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#1e3a8a] to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {shepherd.fullName[0]}
            </div>
            <button
              onClick={() => {
                if (confirm("Sign out of the Shepherd Portal?")) {
                  startTransition(async () => {
                    await logoutShepherd();
                  });
                }
              }}
              title="Sign Out"
              className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("disciples")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "disciples"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="h-4 w-4 text-[#1e3a8a]" />
              <span>My Flock ({disciples.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("attendance")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "attendance"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CalendarCheck className="h-4 w-4 text-green-600" />
              <span>Service Register</span>
            </button>

            <button
              onClick={() => setActiveTab("spiritual")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "spiritual"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Heart className="h-4 w-4 text-red-500" />
              <span>Spiritual Walk</span>
            </button>
          </div>

          {activeTab === "disciples" && (
            <button
              onClick={() => {
                setIsAddModalOpen(true);
                setCandidateSearch("");
                setCandidateSourceFilter("all");
                setSelectedCandidateIds([]);
                handleCandidateSearch("");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-blue-900 active:scale-[0.98] transition-all cursor-pointer w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              <span>Add Disciple to Flock</span>
            </button>
          )}
        </div>

        {/* ------------------------------------------------ Tab 1: My Flock ------------------------------------------------ */}
        {activeTab === "disciples" && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Total Disciples
                </span>
                <span className="text-2xl font-black text-slate-900">{disciples.length}</span>
                <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                  Assigned to your care
                </span>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  School of Baptism
                </span>
                <span className="text-2xl font-black text-amber-600">
                  {disciples.filter((d) => d.disciple.source === "sob").length}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                  SOB disciples
                </span>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Thriving Walk
                </span>
                <span className="text-2xl font-black text-green-600">
                  {disciples.filter((d) => latestStatusByMember.get(d.member.id) === "Thriving").length}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                  Vibrant quiet time &amp; prayer
                </span>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Needs Attention
                </span>
                <span className="text-2xl font-black text-red-600">
                  {
                    disciples.filter(
                      (d) =>
                        latestStatusByMember.get(d.member.id) === "Needs Attention" ||
                        latestStatusByMember.get(d.member.id) === "Critical"
                    ).length
                  }
                </span>
                <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                  Requires pastoral call/visit
                </span>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search disciples by name, phone, or category..."
                className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]"
              />
            </div>

            {/* Disciples List */}
            {filteredDisciples.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-4">
                <div className="h-16 w-16 mx-auto rounded-3xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center">
                  <Compass className="h-8 w-8 text-[#1e3a8a]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {disciples.length === 0 ? "No Disciples In Your Flock Yet" : "No Disciples Found"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {disciples.length === 0
                      ? "Start by selecting disciples from Church Members or School of Baptism candidates to shepherd."
                      : "Try clearing your search term to see all disciples in your care."}
                  </p>
                </div>
                {disciples.length === 0 && (
                  <button
                    onClick={() => {
                      setIsAddModalOpen(true);
                      handleCandidateSearch("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-900"
                  >
                    <Plus className="h-4 w-4" /> Pick Disciples
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDisciples.map(({ disciple, member }) => {
                  const status = latestStatusByMember.get(member.id) || "Steady";
                  const attendCount = attendanceCountByMember.get(member.id) ?? 0;

                  return (
                    <div
                      key={disciple.id}
                      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                              {member.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={member.photoUrl}
                                  alt={member.fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-slate-400">
                                  {member.fullName[0]}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-slate-900 truncate">
                                {member.fullName}
                              </h4>
                              <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {member.phone || "No phone registered"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0 ${
                              disciple.source === "sob"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-[#1e3a8a] border border-blue-200"
                            }`}
                          >
                            {disciple.source === "sob" ? "SOB Candidate" : "Member"}
                          </span>
                        </div>

                        {/* Status Tags */}
                        <div className="flex items-center gap-2 pt-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                              status === "Thriving"
                                ? "bg-green-50 text-green-700"
                                : status === "Needs Attention" || status === "Critical"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <Heart className="h-3 w-3" />
                            Walk: {status}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200/60 px-2 py-1 text-[11px] font-semibold text-slate-600">
                            <CalendarCheck className="h-3 w-3 text-slate-400" />
                            {attendCount} Services
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <button
                            onClick={() => setSelectedMemberForSpiritual(member)}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold text-center transition-colors flex items-center justify-center gap-1"
                          >
                            <Heart className="h-3 w-3 text-red-500" />
                            Check-in
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemoveDisciple(disciple.id, member.fullName)}
                          title="Remove from flock"
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------ Tab 2: Service Register ------------------------------------------------ */}
        {activeTab === "attendance" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-green-600" />
                  Service Attendance Register
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record attendance for church services: default presets or custom program titles.
                </p>
              </div>

              <form onSubmit={handleSaveBulkAttendance} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                  {/* Service Date */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                      Service Date
                    </label>
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Service Preset Dropdown */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                      Church Program / Service
                    </label>
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="Wednesday (KJMC)">Wednesday (KJMC)</option>
                      <option value="Friday (Rescue Hour)">Friday (Rescue Hour)</option>
                      <option value="Sunday Service">Sunday Service</option>
                      <option value="Custom">Custom Church Program...</option>
                    </select>
                  </div>

                  {/* Custom Program Input (Conditional) */}
                  {serviceType === "Custom" && (
                    <div className="sm:col-span-1 animate-in fade-in duration-200">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                        Type Program Name
                      </label>
                      <input
                        type="text"
                        value={customProgramName}
                        onChange={(e) => setCustomProgramName(e.target.value)}
                        placeholder="e.g. All Night Vigil, Revival Day 2"
                        required
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  )}
                </div>

                {/* Disciple Roll-call Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Disciple</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Notes (Optional)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {disciples.map(({ disciple, member }) => {
                        const currentStatus = attendanceStatuses[member.id] || "Present";
                        return (
                          <tr key={disciple.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 text-xs font-bold text-slate-500">
                                  {member.photoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={member.photoUrl}
                                      alt={member.fullName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    member.fullName[0]
                                  )}
                                </div>
                                <div>
                                  <span className="block">{member.fullName}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">
                                    {member.phone || "No phone"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                {(["Present", "Absent", "Late", "Excused"] as const).map((st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() =>
                                      setAttendanceStatuses((prev) => ({ ...prev, [member.id]: st }))
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                      currentStatus === st
                                        ? st === "Present"
                                          ? "bg-green-600 text-white shadow-2xs"
                                          : st === "Absent"
                                          ? "bg-red-600 text-white shadow-2xs"
                                          : st === "Late"
                                          ? "bg-amber-600 text-white shadow-2xs"
                                          : "bg-blue-600 text-white shadow-2xs"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={attendanceNotes[member.id] || ""}
                                onChange={(e) =>
                                  setAttendanceNotes((prev) => ({
                                    ...prev,
                                    [member.id]: e.target.value,
                                  }))
                                }
                                placeholder="Add note..."
                                className="w-full max-w-xs h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={pending || disciples.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:from-green-700 hover:to-emerald-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{pending ? "Saving..." : "Save Service Attendance"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Recent Attendance Logs */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Recent Attendance History Logs
              </h4>
              {recentAttendance.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No service logs saved yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Service / Program</th>
                        <th className="py-2.5 px-3">Disciple</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentAttendance.slice(0, 30).map((r) => (
                        <tr key={r.att.id}>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{r.att.serviceDate}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {r.att.serviceType === "Custom"
                              ? r.att.customProgramName || "Custom Program"
                              : r.att.serviceType}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{r.memberName}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                r.att.status === "Present"
                                  ? "bg-green-50 text-green-700"
                                  : r.att.status === "Absent"
                                  ? "bg-red-50 text-red-700"
                                  : r.att.status === "Late"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {r.att.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{r.att.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------ Tab 3: Spiritual Walk ------------------------------------------------ */}
        {activeTab === "spiritual" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1e3a8a]">
                  <BookOpen className="h-4 w-4" />
                  Quiet Time Tracking
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Evaluate whether the disciple maintains regular daily devotion, scripture reading, and personal meditation.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-600">
                  <Flame className="h-4 w-4" />
                  Prayer Life Evaluation
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Monitor prayer consistency, burdens, and encourage regular prayer targets to build spiritual stamina.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-green-600">
                  <Sparkles className="h-4 w-4" />
                  Shepherd Guidance
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Leave pastoral remarks and guidance tips for each disciple to review progress over time.
                </p>
              </div>
            </div>

            {/* Quick Check-in CTA for Disciples */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Select a Disciple to Record Spiritual Walk
                  </h4>
                  <p className="text-xs text-slate-500">
                    Click on any disciple to log their quiet time frequency, scriptures read, and prayer status.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {disciples.map(({ disciple, member }) => (
                  <button
                    key={disciple.id}
                    onClick={() => setSelectedMemberForSpiritual(member)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 transition-colors"
                  >
                    <span>{member.fullName}</span>
                    <Heart className="h-3 w-3 text-red-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Spiritual Walk Timeline */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Recent Spiritual Evaluation Logs
              </h4>

              {recentSpiritualLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No spiritual walk evaluations recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentSpiritualLogs.map(({ log, memberName }) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{memberName}</span>
                          <span className="text-xs text-slate-400 font-mono">• {log.logDate}</span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.spiritualStatus === "Thriving"
                              ? "bg-green-100 text-green-800"
                              : log.spiritualStatus === "Needs Attention" || log.spiritualStatus === "Critical"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          Status: {log.spiritualStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="font-bold text-slate-600 block">Quiet Time:</span>
                          <span className="font-semibold text-slate-800">
                            {log.quietTimeConsistency}
                            {log.quietTimeScripture && ` — ${log.quietTimeScripture}`}
                          </span>
                        </div>

                        <div>
                          <span className="font-bold text-slate-600 block">Prayer Life:</span>
                          <span className="font-semibold text-slate-800">
                            {log.prayerLifeRating}
                            {log.prayerFocusNotes && ` (${log.prayerFocusNotes})`}
                          </span>
                        </div>
                      </div>

                      {log.shepherdRemarks && (
                        <div className="pt-2 border-t border-slate-200/40 text-xs">
                          <span className="font-bold text-[#1e3a8a]">Shepherd Guidance: </span>
                          <span className="text-slate-700 italic">{log.shepherdRemarks}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------- Modal: Add Disciple to Flock -------------------------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Add Disciples to Flock</h3>
                <p className="text-xs text-slate-500">
                  Select candidates from Church Members or School of Baptism (SOB).
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2.5">
              <button
                type="button"
                onClick={() => setCandidateSourceFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  candidateSourceFilter === "all"
                    ? "bg-[#1e3a8a] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Candidates ({candidates.length})
              </button>
              <button
                type="button"
                onClick={() => setCandidateSourceFilter("member")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  candidateSourceFilter === "member"
                    ? "bg-[#1e3a8a] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Church Members ({memberCount})
              </button>
              <button
                type="button"
                onClick={() => setCandidateSourceFilter("sob")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  candidateSourceFilter === "sob"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >
                SOB Candidates ({sobCount})
              </button>
            </div>

            {/* Search Input & Selection Toolbar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => handleCandidateSearch(e.target.value)}
                  placeholder="Type name, phone number, or ministry..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-semibold px-1 text-slate-500">
                <span>
                  Showing <strong className="text-slate-900">{filteredCandidates.length}</strong> candidate(s) •{" "}
                  <strong className="text-[#1e3a8a]">{selectedCandidateIds.length}</strong> selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllVisibleCandidates}
                    className="text-xs font-bold text-[#1e3a8a] hover:underline cursor-pointer"
                  >
                    Select All Visible
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={clearCandidateSelection}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Candidate List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-72">
              {searchingCandidates ? (
                <p className="text-center py-10 text-xs text-slate-400">Loading candidates...</p>
              ) : filteredCandidates.length === 0 ? (
                <p className="text-center py-10 text-xs text-slate-400">
                  {candidateSearch ? "No matching candidates found." : "No candidates available to assign."}
                </p>
              ) : (
                filteredCandidates.map((c) => {
                  const isSelected = selectedCandidateIds.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleSelectCandidate(c.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50/90 border-blue-400 shadow-2xs"
                          : "border-slate-100 hover:border-blue-200 hover:bg-blue-50/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCandidate(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded text-[#1e3a8a] border-slate-300 focus:ring-[#1e3a8a] cursor-pointer"
                        />
                        <div className="h-9 w-9 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">
                          {c.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.photoUrl} alt={c.fullName} className="h-full w-full object-cover" />
                          ) : (
                            c.fullName[0]
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate">{c.fullName}</p>
                          <p className="text-[11px] text-slate-500 font-medium truncate">
                            {c.phone || "No phone"} •{" "}
                            <span className={c.source === "sob" ? "text-amber-600 font-bold" : "text-blue-600 font-bold"}>
                              {c.sourceLabel}
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddDisciple(c.id, c.source);
                        }}
                        disabled={pending}
                        className="px-3 py-1.5 rounded-xl bg-[#1e3a8a] text-white text-xs font-bold hover:bg-blue-900 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-600">
                {selectedCandidateIds.length} candidate(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedDisciples}
                  disabled={pending || selectedCandidateIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#1e3a8a] text-white text-xs font-bold shadow-md hover:bg-blue-900 transition-all cursor-pointer disabled:opacity-50"
                >
                  {pending
                    ? "Adding Disciples..."
                    : `Add ${selectedCandidateIds.length > 0 ? selectedCandidateIds.length : ""} Disciple${selectedCandidateIds.length === 1 ? "" : "s"} to Flock`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------- Modal: Spiritual Walk Check-In -------------------------------- */}
      {selectedMemberForSpiritual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  Spiritual Walk Check-In
                </h3>
                <p className="text-xs text-slate-500">
                  Disciple: <span className="font-bold text-slate-800">{selectedMemberForSpiritual.fullName}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedMemberForSpiritual(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSpiritual} className="space-y-4 text-xs">
              <input type="hidden" name="memberId" value={selectedMemberForSpiritual.id} />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Check-In Date</label>
                <input
                  type="date"
                  name="logDate"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Quiet Time Consistency</label>
                <select
                  name="quietTimeConsistency"
                  defaultValue="Daily"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="Daily">Daily (Every day devotion)</option>
                  <option value="4-6 Days">4–6 Days a week</option>
                  <option value="1-3 Days">1–3 Days a week</option>
                  <option value="Inconsistent">Inconsistent / Sporadic</option>
                  <option value="None">None / Struggling</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Scriptures Read / Book of the Bible</label>
                <input
                  type="text"
                  name="quietTimeScripture"
                  placeholder="e.g. John 1-5, Psalms 23, Romans"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Prayer Life Rating</label>
                <select
                  name="prayerLifeRating"
                  defaultValue="Consistent"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="Vibrant">Vibrant &amp; Fervent (Prays daily &amp; targets)</option>
                  <option value="Consistent">Consistent (Regular prayer times)</option>
                  <option value="Needs Growth">Needs Growth (Occasionally misses)</option>
                  <option value="Struggling">Struggling / Needs Prayer Support</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Prayer Focus / Burdens / Requests</label>
                <textarea
                  name="prayerFocusNotes"
                  rows={2}
                  placeholder="e.g. Family salvation, exams, job search, spiritual strength"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Overall Spiritual Status</label>
                <select
                  name="spiritualStatus"
                  defaultValue="Steady"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="Thriving">Thriving (Growing strongly)</option>
                  <option value="Steady">Steady (Stable in faith)</option>
                  <option value="Needs Attention">Needs Attention (Backsliding risk / cold)</option>
                  <option value="Critical">Critical (Immediate follow-up required)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Shepherd Guidance Remarks</label>
                <textarea
                  name="shepherdRemarks"
                  rows={2}
                  placeholder="Encouragement, scripture given, next follow-up action..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForSpiritual(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold shadow-md hover:from-red-700 hover:to-pink-700 transition-all cursor-pointer"
                >
                  {pending ? "Saving..." : "Save Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
