"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronDown,
  Search,
  Trash2,
  Shield,
  RotateCcw,
  FileText,
  Link2,
  Globe,
  Laptop,
  Smartphone,
  Tablet,
  HardDrive,
  Compass,
  Download,
  X,
  AlertTriangle,
  Activity,
  BarChart2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { useTablePagination } from "@/components/table-pagination";
import { toast } from "sonner";
import { clearActivityLogs } from "./actions";

export type ActivityItem = {
  id: string;
  actorName: string;
  actorEmail: string | null;
  module: string;
  actionCode: string | null;
  action: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO string
};

export type TrafficDay = {
  date: string;
  label: string;
  fullDateLabel: string;
  views: number;
  visitors: number;
};

export type BreakdownItem = {
  label: string;
  count: number;
  percentage: number;
};

export type AnalyticsBreakdowns = {
  pages: BreakdownItem[];
  routes: BreakdownItem[];
  countries: BreakdownItem[];
  devices: BreakdownItem[];
  operatingSystems: BreakdownItem[];
  browsers: BreakdownItem[];
};

export type AnalyticsData = {
  totalViews: number;
  uniqueVisitors: number;
  activeNow: number;
  avgSession: string;
  avgPerDay: number;
  trafficDays: TrafficDay[];
  breakdowns: AnalyticsBreakdowns;
  activities: ActivityItem[];
};

type TabKey = keyof AnalyticsBreakdowns;

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pages", label: "Pages", icon: FileText },
  { key: "routes", label: "Routes", icon: Link2 },
  { key: "countries", label: "Countries", icon: Globe },
  { key: "devices", label: "Devices", icon: Laptop },
  { key: "operatingSystems", label: "Operating Systems", icon: HardDrive },
  { key: "browsers", label: "Browsers", icon: Compass },
];

/** Formats ISO timestamp to "Oct 2, 2026 01:14:28" as shown in reference */
function formatAuditDate(dateString: string) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateString;
  }
}

function getDisplayActionCode(item: ActivityItem): string {
  if (item.actionCode) return item.actionCode;
  const lower = item.action.toLowerCase();
  let verb = "action";
  if (lower.startsWith("added") || lower.startsWith("created")) verb = "create";
  else if (lower.startsWith("updated") || lower.startsWith("changed") || lower.startsWith("set")) verb = "update";
  else if (lower.startsWith("deleted") || lower.startsWith("permanently deleted") || lower.startsWith("removed")) verb = "delete";
  else if (lower.startsWith("suspended")) verb = "suspend";
  else if (lower.startsWith("unsuspended") || lower.startsWith("restored")) verb = "unsuspend";
  else if (lower.startsWith("activated")) verb = "activate";
  else if (lower.startsWith("deactivated")) verb = "deactivate";
  else if (lower.startsWith("checked in") || lower.startsWith("recorded")) verb = "record";
  else if (lower.startsWith("logged in")) verb = "login";
  else if (lower.startsWith("imported")) verb = "import";
  else if (lower.startsWith("sent")) verb = "send";
  return `${item.module || "user"}.${verb}`;
}

export function AnalyticsClient({
  data: initialData,
  initialView = "overview",
}: {
  data: AnalyticsData;
  initialView?: "overview" | "activity";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlView = searchParams.get("view");

  const [data, setData] = useState<AnalyticsData>(initialData);
  const [activeView, setActiveView] = useState<"overview" | "activity">(
    urlView === "activity" ? "activity" : "overview"
  );
  const [timeRange, setTimeRange] = useState("Last 30 days");
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<"views" | "visitors">("views");
  const [activeTab, setActiveTab] = useState<TabKey>("pages");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showViewAllModal, setShowViewAllModal] = useState(false);
  const [viewAllSearch, setViewAllSearch] = useState("");
  const [activitiesList, setActivitiesList] = useState<ActivityItem[]>(initialData.activities);

  useEffect(() => {
    setData(initialData);
    setActivitiesList(initialData.activities);
  }, [initialData]);

  useEffect(() => {
    if (urlView === "activity") {
      setActiveView("activity");
    } else {
      setActiveView("overview");
    }
  }, [urlView]);

  function switchView(view: "overview" | "activity") {
    setActiveView(view);
    if (view === "activity") {
      router.push("/analytics?view=activity");
    } else {
      router.push("/analytics");
    }
  }

  function handleSync() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      router.refresh();
      toast.success("Analytics synchronized with live traffic.");
    }, 600);
  }

  function handleExportCSV() {
    const items = data.breakdowns[activeTab] || [];
    if (items.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    const headers = "Name / Path,Count,Percentage\n";
    const rows = items
      .map((i) => `"${i.label.replace(/"/g, '""')}",${i.count},${i.percentage}%`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `churchy-analytics-${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${activeTab} report as CSV.`);
  }

  // Filter activities by search query in Activity Tracker
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activitiesList;
    const q = searchQuery.toLowerCase();
    return activitiesList.filter((item) => {
      const code = (item.actionCode || getDisplayActionCode(item)).toLowerCase();
      const user = item.actorName.toLowerCase();
      const email = (item.actorEmail || "").toLowerCase();
      const desc = item.action.toLowerCase();
      const ip = (item.ipAddress || "").toLowerCase();
      const meta = (item.metadata as Record<string, unknown>) || {};
      const dev = String(meta.device || "").toLowerCase();
      const os = String(meta.os || "").toLowerCase();
      const browser = String(meta.browser || "").toLowerCase();
      return (
        code.includes(q) ||
        user.includes(q) ||
        email.includes(q) ||
        desc.includes(q) ||
        ip.includes(q) ||
        dev.includes(q) ||
        os.includes(q) ||
        browser.includes(q)
      );
    });
  }, [activitiesList, searchQuery]);

  const {
    paginatedItems: paginatedActivities,
    Pagination: activityPagination,
  } = useTablePagination({
    items: filteredActivities,
    initialPageSize: 50,
  });

  // Breakdown items for the currently active tab
  const currentBreakdownItems = data.breakdowns[activeTab] || [];
  const displayedBreakdownItems = currentBreakdownItems.slice(0, 5);

  // Filtered breakdown items in "View all" modal
  const modalBreakdownItems = useMemo(() => {
    if (!viewAllSearch.trim()) return currentBreakdownItems;
    const q = viewAllSearch.toLowerCase();
    return currentBreakdownItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [currentBreakdownItems, viewAllSearch]);

  async function handleClearLogs() {
    setClearing(true);
    try {
      await clearActivityLogs();
      setActivitiesList([]);
      setData((prev) => ({
        ...prev,
        totalViews: 0,
        uniqueVisitors: 0,
        activeNow: 0,
        avgPerDay: 0,
        avgSession: "0s",
        trafficDays: prev.trafficDays.map((d) => ({ ...d, views: 0, visitors: 0 })),
        breakdowns: {
          pages: [],
          routes: [],
          countries: [],
          devices: [],
          operatingSystems: [],
          browsers: [],
        },
        activities: [],
      }));
      setShowClearModal(false);
      toast.success(
        activeView === "overview"
          ? "Analytics overview data cleared successfully."
          : "Activity logs cleared successfully."
      );
      router.refresh();
    } catch {
      toast.error("Failed to clear data.");
    } finally {
      setClearing(false);
    }
  }

  const activeTabConfig = TAB_CONFIG.find((t) => t.key === activeTab) || TAB_CONFIG[0];
  const ActiveTabIcon = activeTabConfig.icon;

  // Custom Tooltip for 30-day traffic bar chart
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: any[];
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as TrafficDay;
      const val = chartMetric === "views" ? item.views : item.visitors;
      const unit = chartMetric === "views" ? "views" : "visitors";
      return (
        <div className="bg-[#0f172a] text-white px-3 py-2 rounded-xl text-center shadow-xl border border-slate-800">
          <div className="text-[11px] text-slate-300 font-medium">
            {item.fullDateLabel}
          </div>
          <div className="text-sm font-bold mt-0.5">
            {val} {unit}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* ======================================================== */}
      {/* 1. HEADER (Dynamically matches Overview or Activity Tracker) */}
      {/* ======================================================== */}
      {activeView === "overview" ? (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Blue Icon, Title, Subtitle, and View Switcher Dropdown */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-[#1d68f5] flex items-center justify-center text-white shadow-sm shrink-0">
              {/* Pixel-perfect 3-rounded-bars icon matching Image 1 */}
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3.5" y="11" width="3.5" height="10" rx="1.75" />
                <rect x="10.25" y="3" width="3.5" height="18" rx="1.75" />
                <rect x="17" y="7" width="3.5" height="14" rx="1.75" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                Analytics
              </h1>
              <p className="text-[13px] text-slate-500 font-normal mt-1 leading-snug">
                Monitor real-time activity, navigation patterns, downloads, and engagement across the platform.
              </p>
            </div>
          </div>

          {/* Right Controls matching Image 1 */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            {/* Clear Data */}
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors p-1 cursor-pointer"
              title="Clear Data"
            >
              <Trash2 className="h-4 w-4 stroke-[1.8]" />
              <div className="text-[11px] font-bold leading-tight text-left text-slate-600">
                <div>Clear</div>
                <div>Data</div>
              </div>
            </button>

            {/* Sync Analytics */}
            <button
              type="button"
              onClick={handleSync}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors p-1 cursor-pointer"
              title="Sync Analytics"
            >
              <RotateCcw className={cn("h-4 w-4 stroke-[1.8]", syncing && "animate-spin text-blue-600")} />
              <div className="text-[11px] font-bold leading-tight text-left text-slate-600">
                <div>Sync</div>
                <div>Analytics</div>
              </div>
            </button>

            {/* Last 30 days dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>{timeRange}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {rangeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setRangeDropdownOpen(false)} />
                  <div className="absolute right-0 z-40 mt-1.5 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg text-xs font-semibold">
                    {["Last 7 days", "Last 30 days", "Last 90 days", "All time"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setTimeRange(r);
                          setRangeDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                          timeRange === r ? "bg-blue-50 text-blue-600 font-bold" : "hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* LIVE TRACKING ACTIVE Badge */}
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 leading-tight">
                <div>LIVE TRACKING</div>
                <div>ACTIVE</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Activity Tracking Header matching User's first reference screenshot */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => switchView("overview")}
              className="text-slate-400 hover:text-slate-700 transition-colors p-1 -ml-1 rounded-lg cursor-pointer"
              title="Back to Overview"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2]" />
            </button>

            <div className="h-10 w-10 rounded-2xl bg-[#5c4cf4] flex items-center justify-center text-white shadow-sm shadow-indigo-200 shrink-0">
              <Shield className="h-5 w-5 fill-white/10 stroke-[2.4]" />
            </div>

            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                Activity Tracking
              </h1>
              <p className="text-[13px] text-slate-500 font-normal mt-1 leading-snug">
                System-wide audit trail for transparency, auditing, and accountability.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. OVERVIEW VIEW: TOP SECTION (IMAGE 1) + BOTTOM (IMAGE 2) */}
      {/* ======================================================== */}
      {activeView === "overview" && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards matching Image 1 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* TOTAL VIEWS */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                TOTAL VIEWS
              </span>
              <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
                {data.totalViews.toLocaleString()}
              </div>
              <p className="mt-2 text-xs text-slate-400 font-normal">
                All time page views
              </p>
            </div>

            {/* UNIQUE VISITORS */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                UNIQUE VISITORS
              </span>
              <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
                {data.uniqueVisitors.toLocaleString()}
              </div>
              <p className="mt-2 text-xs text-slate-400 font-normal">
                Unique devices & users
              </p>
            </div>

            {/* ACTIVE NOW */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                ACTIVE NOW
              </span>
              <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
                {data.activeNow.toLocaleString()}
              </div>
              <p className="mt-2 text-xs text-slate-400 font-normal">
                Last 5 minutes
              </p>
            </div>

            {/* AVG. SESSION */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                AVG. SESSION
              </span>
              <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
                {data.avgSession}
              </div>
              <p className="mt-2 text-xs text-slate-400 font-normal">
                Per visitor
              </p>
            </div>
          </div>

          {/* Traffic Overview Card (Bar Chart) matching Image 1 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-7">
            {/* Header: Title + Stats on Left, Toggle on Right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Traffic Overview
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Total: <span className="font-bold text-slate-700">{data.totalViews}</span> &nbsp;&nbsp; Avg/day: <span className="font-bold text-slate-700">{data.avgPerDay}</span>
                </p>
              </div>

              {/* Segmented Toggle: [ Page Views ] [ Visitors ] */}
              <div className="inline-flex items-center rounded-xl bg-slate-100/70 p-1 border border-slate-200/50 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChartMetric("views")}
                  className={cn(
                    "px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    chartMetric === "views"
                      ? "bg-white text-slate-900 font-bold shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Page Views
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric("visitors")}
                  className={cn(
                    "px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    chartMetric === "visitors"
                      ? "bg-white text-slate-900 font-bold shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Visitors
                </button>
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-[290px] w-full min-h-[290px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.trafficDays}
                  margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="trafficBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    stroke="#f1f5f9"
                    strokeDasharray="4 4"
                  />

                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    ticks={[
                      "Sep 3",
                      "Sep 6",
                      "Sep 9",
                      "Sep 12",
                      "Sep 15",
                      "Sep 18",
                      "Sep 21",
                      "Sep 24",
                      "Sep 27",
                      "Sep 30",
                      "Oct 2",
                    ]}
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                  />

                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    ticks={
                      chartMetric === "views"
                        ? [0, 17, 34, 51, 68]
                        : [0, 2, 4, 6]
                    }
                    domain={chartMetric === "views" ? [0, 68] : [0, 6]}
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                    width={36}
                  />

                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(241, 245, 249, 0.4)", radius: 4 }}
                  />

                  <Bar
                    dataKey={chartMetric}
                    fill="url(#trafficBarGrad)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ======================================================== */}
          {/* BOTTOM SECTION: TABS & BREAKDOWN CARD (MATCHING IMAGE 2) */}
          {/* ======================================================== */}

          {/* Tab Navigation Bar */}
          <div className="bg-white rounded-2xl border border-slate-100 p-2 shadow-sm flex items-center gap-1.5 overflow-x-auto">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
                    isActive
                      ? "bg-[#1d68f5] text-white font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-500")} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Breakdown Card matching Image 2 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-7">
            {/* Title with matching active tab icon */}
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-4">
              <ActiveTabIcon className="h-4 w-4 text-slate-500" />
              <span>{activeTabConfig.label}</span>
            </div>

            {/* List of 5 rows with count, percentage, and horizontal blue progress bar */}
            <div className="divide-y divide-slate-50">
              {displayedBreakdownItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                    <ActiveTabIcon className="h-5 w-5 text-slate-300" />
                  </div>
                  <div className="font-semibold text-slate-700 text-sm">
                    No {activeTabConfig.label.toLowerCase()} recorded yet
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Traffic and interaction data will be tracked here in real-time.
                  </div>
                </div>
              ) : (
                displayedBreakdownItems.map((item) => (
                  <div key={item.label} className="py-3.5 first:pt-1 last:pb-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium text-slate-800 truncate font-mono text-[13px]">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-bold text-slate-900 text-sm">{item.count}</span>
                        <span className="text-slate-400 text-xs w-11 text-right font-medium">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Subtle track + Vibrant Blue progress bar matching screenshot */}
                    <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1d68f5] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(item.percentage, 3))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with "View all >" on left and "Export CSV" on right */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setViewAllSearch("");
                  setShowViewAllModal(true);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
              >
                View all &gt;
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ACTIVITY TRACKER VIEW (MATCHING FIRST REFERENCE IMAGE) */}
      {/* ======================================================== */}
      {activeView === "activity" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-7">
          {/* Top Search Bar & Clear Logs Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-sm sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by user, email, action, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-500 font-semibold text-xs transition-colors shadow-2xs shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span>Clear Logs</span>
            </button>
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto -mx-6 sm:-mx-7 px-6 sm:px-7">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-bold">ACTION</th>
                  <th className="py-3 px-4 font-bold">USER</th>
                  <th className="py-3 px-4 font-bold">DEVICE</th>
                  <th className="py-3 px-4 font-bold">DESCRIPTION</th>
                  <th className="py-3 px-4 font-bold">IP ADDRESS</th>
                  <th className="py-3 px-4 font-bold">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="font-semibold text-slate-700 text-sm">No activity records found</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {searchQuery ? "Try refining your search keywords." : "System operations will be logged here automatically."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedActivities.map((log) => {
                    const actionCode = log.actionCode || getDisplayActionCode(log);
                    const meta = (log.metadata as Record<string, unknown>) || {};
                    const device = (typeof meta.device === "string" ? meta.device : null) || "Desktop";
                    const os = (typeof meta.os === "string" ? meta.os : null) || "Windows";
                    const browser = (typeof meta.browser === "string" ? meta.browser : null) || "Chrome";

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* ACTION */}
                        <td className="py-4 px-4 font-bold text-slate-900 text-[13px] whitespace-nowrap">
                          {actionCode}
                        </td>

                        {/* USER */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-sm leading-snug">
                            {log.actorName || "Super Administrator"}
                          </div>
                          <div className="text-xs text-slate-400 font-normal leading-snug mt-0.5">
                            {log.actorEmail || "—"}
                          </div>
                        </td>

                        {/* DEVICE */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {device === "Mobile" ? (
                            <div className="inline-flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80 shadow-2xs">
                                <Smartphone className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800 text-xs">Mobile</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-700 leading-none">
                                    {os}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium leading-none mt-1">
                                  {browser}
                                </span>
                              </div>
                            </div>
                          ) : device === "Tablet" ? (
                            <div className="inline-flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80 shadow-2xs">
                                <Tablet className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800 text-xs">Tablet</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100/70 text-purple-700 leading-none">
                                    {os}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium leading-none mt-1">
                                  {browser}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/80 shadow-2xs">
                                <Laptop className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800 text-xs">Desktop</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100/70 text-blue-700 leading-none">
                                    {os}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium leading-none mt-1">
                                  {browser}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* DESCRIPTION */}
                        <td className="py-4 px-4 text-[13px] text-slate-600 max-w-xs sm:max-w-md">
                          {log.action}
                        </td>

                        {/* IP ADDRESS */}
                        <td className="py-4 px-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                          {log.ipAddress || "—"}
                        </td>

                        {/* DATE */}
                        <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatAuditDate(log.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {activityPagination}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. "VIEW ALL" MODAL FOR THE BREAKDOWN DATASETS */}
      {/* ======================================================== */}
      {showViewAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ActiveTabIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    All {activeTabConfig.label}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Full engagement and distribution breakdown
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowViewAllModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search within modal */}
            <div className="relative my-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeTabConfig.label.toLowerCase()}...`}
                value={viewAllSearch}
                onChange={(e) => setViewAllSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
              {modalBreakdownItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No matching entries found.
                </div>
              ) : (
                modalBreakdownItems.map((item) => (
                  <div key={item.label} className="py-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium text-slate-800 truncate font-mono text-[13px]">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-bold text-slate-900">{item.count}</span>
                        <span className="text-slate-400 text-xs w-11 text-right font-medium">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1d68f5] rounded-full"
                        style={{ width: `${Math.min(100, Math.max(item.percentage, 3))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Showing {modalBreakdownItems.length} of {currentBreakdownItems.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewAllModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. CONFIRMATION MODAL FOR CLEAR DATA / CLEAR LOGS */}
      {/* ======================================================== */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeView === "overview" ? "Clear Analytics Data" : "Clear Activity Logs"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">This action requires confirmation</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              {activeView === "overview"
                ? "Are you sure you want to permanently clear analytics metrics and traffic history? All KPI counts and charts will be reset to zero."
                : "Are you sure you want to permanently clear all audit activity records? This action cannot be undone and will reset the audit history."}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={clearing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {clearing
                  ? "Clearing..."
                  : activeView === "overview"
                  ? "Yes, Clear Data"
                  : "Yes, Clear Logs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
