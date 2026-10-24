"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  HeartHandshake,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { recordSundayAttendance, saveDepartmentServiceNotes } from "./actions";
import { useTablePagination } from "@/components/table-pagination";
import { cn } from "@/lib/utils";

type Department = { id: string; name: string };

type Member = {
  id: string;
  fullName: string;
  category: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  lastAttendedAt: string | null;
  photoUrl: string | null;
  joinedAt: string | null;
};

type HistoryPoint = {
  date: string;
  present: number;
  absent: number;
  total: number;
  rate: number;
};

function DeptCategoryBadge({ category }: { category: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-slate-600 shrink-0">
      {category}
    </span>
  );
}

type Props = {
  department: Department;
  allDepartments: Department[];
  selectedDate: string;
  members: Member[];
  dateAttendance: { memberId: string; status: string; notes: string | null }[];
  historyData: HistoryPoint[];
  memberStatsMap: Record<string, { present: number; absent: number }>;
  initialTab: string;
  churchName: string;
  absenceTemplate: string;
  isAdmin: boolean;
};

export function DepartmentPortalClient({
  department,
  allDepartments,
  selectedDate,
  members,
  dateAttendance,
  historyData,
  memberStatsMap,
  initialTab,
  churchName,
  absenceTemplate,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"attendance" | "members" | "analytics">(
    (initialTab as any) || "attendance",
  );
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const initialNote = dateAttendance.find((a) => a.notes)?.notes || "";
  const [notes, setNotes] = useState(initialNote);
  const [sendAbsenceSms, setSendAbsenceSms] = useState(true);
  const [isSavingNotes, startSavingNotesTransition] = useTransition();

  useEffect(() => {
    setNotes(dateAttendance.find((a) => a.notes)?.notes || "");
  }, [dateAttendance]);

  const handleSaveNotes = () => {
    startSavingNotesTransition(async () => {
      try {
        const res = await saveDepartmentServiceNotes({
          departmentId: department.id,
          serviceDate: currentDate,
          notes,
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Service remarks saved!");
          router.refresh();
        }
      } catch {
        toast.error("Failed to save service remarks.");
      }
    });
  };

  // Track checked members for current date
  const isAlreadyRecorded = dateAttendance.length > 0;
  const initialPresentIds = new Set(
    dateAttendance.filter((a) => a.status === "present").map((a) => a.memberId),
  );

  const [presentMemberIds, setPresentMemberIds] = useState<Set<string>>(() => {
    if (isAlreadyRecorded) {
      return initialPresentIds;
    }
    return new Set<string>();
  });

  useEffect(() => {
    if (dateAttendance.length > 0) {
      setPresentMemberIds(
        new Set(
          dateAttendance
            .filter((a) => a.status === "present")
            .map((a) => a.memberId),
        ),
      );
    } else {
      setPresentMemberIds(new Set<string>());
    }
  }, [dateAttendance, selectedDate]);

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    router.push(`/department-portal?deptId=${department.id}&date=${newDate}&tab=${activeTab}`);
  };

  const toggleMember = (id: string) => {
    setPresentMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markAllPresent = () => {
    setPresentMemberIds(new Set(members.map((m) => m.id)));
  };

  const clearAll = () => {
    setPresentMemberIds(new Set());
  };

  const handleSaveAttendance = () => {
    if (members.length === 0) {
      toast.error("No members in this department to take attendance for.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await recordSundayAttendance({
          departmentId: department.id,
          serviceDate: currentDate,
          presentMemberIds: Array.from(presentMemberIds),
          sendAbsenceSms: true,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(
            `Sunday attendance saved successfully! (${res.presentCount} present, ${res.absentCount} absent)`,
          );
          router.refresh();
        }
      } catch (err) {
        toast.error("Failed to save attendance. Please try again.");
      }
    });
  };

  const filteredMembers = members.filter((m) =>
    m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.phone && m.phone.includes(searchQuery)),
  );

  const {
    paginatedItems: paginatedDirectoryMembers,
    Pagination: directoryPagination,
  } = useTablePagination({
    items: filteredMembers,
    initialPageSize: 50,
  });

  const {
    paginatedItems: paginatedChecklistMembers,
    Pagination: checklistPagination,
  } = useTablePagination({
    items: filteredMembers,
    initialPageSize: 50,
  });

  const presentCount = members.filter((m) => presentMemberIds.has(m.id)).length;
  const absentCount = members.length - presentCount;
  const attendanceRate = members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0;

  // Analytics metrics
  const avgAttendanceRate =
    historyData.length > 0
      ? Math.round(historyData.reduce((acc, h) => acc + h.rate, 0) / historyData.length)
      : attendanceRate;

  return (
    <div className="space-y-6">
      {/* Top Banner / Department Header */}
      <div className="rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a8a] text-amber-400 shadow-md">
              <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Department Management
                </span>
                {isAdmin && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black text-blue-700 uppercase shrink-0">
                    Admin View
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight truncate">
                {department.name}
              </h1>
            </div>
          </div>

          {/* Department switcher for Admins */}
          {isAdmin && allDepartments.length > 1 && (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs font-bold text-slate-500 shrink-0">Switch Dept:</span>
              <select
                value={department.id}
                onChange={(e) =>
                  router.push(
                    `/department-portal?deptId=${e.target.value}&date=${currentDate}&tab=${activeTab}`,
                  )
                }
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              >
                {allDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 sm:mt-8 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setActiveTab("attendance")}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === "attendance"
                ? "bg-[#1e3a8a] text-white shadow-xs"
                : "text-slate-500 hover:bg-slate-100",
            )}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Attendance</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px]",
                activeTab === "attendance" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {members.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("members")}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === "members"
                ? "bg-[#1e3a8a] text-white shadow-xs"
                : "text-slate-500 hover:bg-slate-100",
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>Members</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === "analytics"
                ? "bg-[#1e3a8a] text-white shadow-xs"
                : "text-slate-500 hover:bg-slate-100",
            )}
          >
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span>Data &amp; Charts</span>
          </button>
        </div>
      </div>

      {/* ----------------- TAB 1: SUNDAY ATTENDANCE ----------------- */}
      {activeTab === "attendance" && (
        <div className="space-y-5 sm:space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Date Selector */}
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-100 bg-white p-3.5 sm:p-4 shadow-xs">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Service Date
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
            </div>

            {/* Quick Status Card */}
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-100 bg-white p-3.5 sm:p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Attendance Status
              </span>
              <div className="mt-2 flex items-center gap-2">
                {isAlreadyRecorded ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Recorded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> Pending Submission
                  </span>
                )}
              </div>
            </div>

            {/* Present Count */}
            <div className="col-span-1 rounded-2xl border border-slate-100 bg-white p-3.5 sm:p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Present
              </span>
              <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900">
                {presentCount}{" "}
                <span className="text-xs font-bold text-slate-400">/ {members.length}</span>
              </p>
            </div>

            {/* Absent Count */}
            <div className="col-span-1 rounded-2xl border border-slate-100 bg-white p-3.5 sm:p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                Absent
              </span>
              <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900">
                {absentCount}{" "}
                <span className="text-xs font-bold text-slate-400">
                  ({100 - attendanceRate}%)
                </span>
              </p>
            </div>
          </div>

          {/* Members Checklist Table */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-xs overflow-hidden">
            {/* Checklist Action Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 bg-slate-50/50 p-3.5 sm:p-4 px-4 sm:px-6">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search member name or phone…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>

              {!isAdmin ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="flex-1 sm:flex-initial rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 transition-colors uppercase tracking-tight cursor-pointer"
                  >
                    <UserCheck className="inline h-3.5 w-3.5 mr-1" /> Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex-1 sm:flex-initial rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-tight cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Admin Oversight · Read-Only Data
                </span>
              )}
            </div>

            {/* Checklist Rows */}
            {filteredMembers.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="mx-auto h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs font-bold italic">
                  {searchQuery ? "No members match your search." : "No members assigned to this department yet."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paginatedChecklistMembers.map((member) => {
                  const isPresent = !isAdmin
                    ? presentMemberIds.has(member.id)
                    : isAlreadyRecorded
                    ? dateAttendance.some((a) => a.memberId === member.id && a.status === "present")
                    : false;
                  const isRecordedAbsent = !isAdmin
                    ? !presentMemberIds.has(member.id)
                    : isAlreadyRecorded
                    ? dateAttendance.some((a) => a.memberId === member.id && a.status === "absent")
                    : false;

                  return (
                    <div
                      key={member.id}
                      onClick={() => (!isAdmin ? toggleMember(member.id) : undefined)}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3.5 sm:p-4 px-4 sm:px-6 transition-colors select-none",
                        !isAdmin ? "cursor-pointer" : "cursor-default",
                        isPresent
                          ? "bg-emerald-50/30 hover:bg-emerald-50/50"
                          : !isAdmin
                          ? "hover:bg-slate-50"
                          : isRecordedAbsent
                          ? "bg-amber-50/30 hover:bg-amber-50/50"
                          : "hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        {/* Custom Tick Checkbox for Dept Head, or Status Icon for Admin */}
                        {!isAdmin ? (
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 transition-all",
                              isPresent
                                ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                                : "border-slate-300 bg-white hover:border-slate-400",
                            )}
                          >
                            {isPresent && <CheckCircle2 className="h-4 w-4 stroke-[3]" />}
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
                              isPresent
                                ? "bg-emerald-100 text-emerald-800"
                                : isRecordedAbsent
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-400",
                            )}
                          >
                            {isPresent ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : isRecordedAbsent ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                        )}

                        {/* Member Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {member.fullName}
                            </span>
                            <DeptCategoryBadge category={member.category} />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                            <span className="truncate">{member.phone || "No phone"}</span>
                            {member.lastAttendedAt && (
                              <span className="shrink-0 hidden min-[400px]:inline">
                                · Last seen:{" "}
                                {new Date(member.lastAttendedAt + "T00:00:00").toLocaleDateString(
                                  "en-GB",
                                  { day: "numeric", month: "short" },
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span
                        className={cn(
                          "rounded-full px-2.5 sm:px-3 py-1 text-[10px] font-black uppercase tracking-tight shrink-0",
                          isPresent
                            ? "bg-emerald-100 text-emerald-800"
                            : !isAdmin
                            ? "bg-amber-100 text-amber-800"
                            : isAlreadyRecorded
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {isPresent
                          ? "Present"
                          : !isAdmin
                          ? "Absent"
                          : isAlreadyRecorded
                          ? "Absent"
                          : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {checklistPagination}
          </div>

          {/* Automated Care Card - Returned for Admin department portal */}
          {isAdmin && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a8a] text-white">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">
                      Automated Care: Warm Message for Absentees
                    </h3>
                    <p className="text-xs text-slate-500">
                      Members who are not ticked will automatically receive a personalized message of love.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendAbsenceSms}
                    onChange={(e) => setSendAbsenceSms(e.target.checked)}
                    className="h-4 w-4 rounded-md border-slate-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                  />
                  <span className="text-xs font-bold text-slate-700">Enable Warm SMS</span>
                </label>
              </div>

              {sendAbsenceSms && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-[10px] text-blue-900 uppercase tracking-wider block">
                    PREVIEW OF AUTOMATED WARM SMS:
                  </span>
                  <p className="italic text-slate-600">
                    “
                    {(absenceTemplate ||
                      "Hello [name], we missed you at church today! We prayed for you and look forward to seeing you next Sunday. Have a blessed week! — [church]")
                      .replace(/\[name\]|\{name\}/gi, "[Member Name]")
                      .replace(/\[church\]|\{church\}/gi, churchName || "World Ark Missions")}
                    ”
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Sent to {absentCount} absent {absentCount === 1 ? "member" : "members"} upon submission.
                  </p>
                </div>
              )}

              {/* Service Notes / Remarks */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    SERVICE NOTES / REMARKS (OPTIONAL)
                  </label>
                  {isAlreadyRecorded && notes !== initialNote && (
                    <button
                      type="button"
                      disabled={isSavingNotes}
                      onClick={handleSaveNotes}
                      className="text-[10px] font-black text-blue-700 hover:text-blue-900 uppercase tracking-wider cursor-pointer"
                    >
                      {isSavingNotes ? "Saving…" : "Save Note"}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Special Communion service, high turnout"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
            <div className="text-xs text-slate-500 font-medium">
              <span className="font-bold text-slate-900">{presentCount}</span> Present ·{" "}
              <span className="font-bold text-slate-900">{absentCount}</span> Absent{" "}
              <span className="text-slate-400">({attendanceRate}% attendance)</span>
            </div>

            {!isAdmin ? (
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveAttendance}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-8 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-blue-900 transition-all disabled:opacity-50"
              >
                {isPending ? (
                  <>Saving Attendance…</>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Save Sunday Attendance
                  </>
                )}
              </button>
            ) : (
              <div className="text-xs font-bold">
                {isAlreadyRecorded ? (
                  <span className="text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Submitted by {department.name} head
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> Awaiting submission from {department.name} head
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- TAB 2: DEPARTMENT MEMBERS ----------------- */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {department.name} Directory ({members.length})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter members…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="py-3 pl-6">Member Name</th>
                  <th className="py-3">Category</th>
                  <th className="py-3">Phone</th>
                  <th className="py-3">Last Seen</th>
                  <th className="py-3 pr-6 text-right">Recent 35-Day Consistency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDirectoryMembers.map((m) => {
                  const stat = memberStatsMap[m.id] || { present: 0, absent: 0 };
                  const totalRecorded = stat.present + stat.absent;
                  const rate = totalRecorded > 0 ? Math.round((stat.present / totalRecorded) * 100) : null;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pl-6 font-bold text-slate-900">{m.fullName}</td>
                      <td className="py-3">
                        <DeptCategoryBadge category={m.category} />
                      </td>
                      <td className="py-3 text-slate-600">{m.phone || "—"}</td>
                      <td className="py-3 text-slate-600">
                        {m.lastAttendedAt
                          ? new Date(m.lastAttendedAt + "T00:00:00").toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 pr-6 text-right">
                        {rate !== null ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black",
                              rate >= 75
                                ? "bg-emerald-50 text-emerald-700"
                                : rate >= 50
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700",
                            )}
                          >
                            {stat.present} / {totalRecorded} Sundays ({rate}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">No recent logs</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {directoryPagination}
          </div>
        </div>
      )}

      {/* ----------------- TAB 3: DATA & CHARTS ----------------- */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Department Roster
              </span>
              <p className="mt-2 text-3xl font-black text-slate-900">{members.length}</p>
              <p className="text-xs text-slate-400 mt-1">Active assigned members</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Avg. Sunday Attendance Rate
              </span>
              <p className="mt-2 text-3xl font-black text-slate-900">{avgAttendanceRate}%</p>
              <p className="text-xs text-slate-400 mt-1">Across recorded sessions</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                Logged Sunday Services
              </span>
              <p className="mt-2 text-3xl font-black text-slate-900">{historyData.length}</p>
              <p className="text-xs text-slate-400 mt-1">Sessions on file</p>
            </div>
          </div>

          {/* Weekly Attendance Chart */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Weekly Attendance Breakdown (Present vs Absent)
                </h3>
                <p className="text-xs text-slate-400">
                  Historical Sunday attendance tracking for {department.name}
                </p>
              </div>
            </div>

            {historyData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs italic">
                <Calendar className="h-8 w-8 opacity-20 mb-2" />
                No historical attendance records yet. Log your first Sunday above!
              </div>
            ) : (
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(val) =>
                        new Date(val + "T00:00:00").toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      }
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "1rem",
                        borderColor: "#e2e8f0",
                        fontWeight: "bold",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: "10px", fontSize: "12px", fontWeight: "bold" }}
                    />
                    <Bar dataKey="present" name="Present" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Attendance Trend Line Chart */}
          {historyData.length > 1 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Attendance Percentage Trend
                </h3>
                <p className="text-xs text-slate-400">Weekly consistency percentage</p>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(val) =>
                        new Date(val + "T00:00:00").toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      }
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      formatter={(val) => [`${val}%`, "Attendance Rate"]}
                      contentStyle={{
                        borderRadius: "1rem",
                        borderColor: "#e2e8f0",
                        fontWeight: "bold",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#1e3a8a"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#rateGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
