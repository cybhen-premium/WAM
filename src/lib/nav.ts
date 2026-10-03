import type { ModuleKey } from "@/lib/modules";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  ChartColumn,
  TrendingUp,
  CreditCard,
  Calendar,
  ClipboardCheck,
  UserCheck,
  HeartHandshake,
  Megaphone,
  MessageSquare,
  GraduationCap,
  Settings,
  HandHeart,
  UserCog,
  Building2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; module: ModuleKey };

/** A collapsible nav group rendered as a dropdown in the sidebar. */
export type NavGroup = {
  label: string;
  icon: LucideIcon;
  module: ModuleKey;
  children: { href: string; label: string }[];
};

export type NavEntry =
  | { type: "item"; item: NavItem }
  | { type: "group"; group: NavGroup };

export type NavCategory = {
  title: string;
  entries: NavEntry[];
};

/** Categorized sidebar navigation arranged exactly in requested order */
export const NAV_CATEGORIES: NavCategory[] = [
  {
    title: "OVERVIEW",
    entries: [
      {
        type: "item",
        item: { href: "/dashboard", module: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      },
    ],
  },
  {
    title: "PEOPLE & MINISTRY",
    entries: [
      {
        type: "item",
        item: { href: "/members", module: "members", label: "Members", icon: Users },
      },
      {
        type: "item",
        item: { href: "/departments", module: "members", label: "Departments", icon: Building2 },
      },
      {
        type: "item",
        item: { href: "/akwaaba", module: "akwaaba", label: "Akwaaba", icon: HandHeart },
      },
      {
        type: "item",
        item: { href: "/visitor-conversion", module: "analytics", label: "Visitors", icon: TrendingUp },
      },
      {
        type: "item",
        item: { href: "/follow-up", module: "care", label: "Follow Up", icon: UserCheck },
      },
      {
        type: "item",
        item: { href: "/sob", module: "sob", label: "SOB", icon: GraduationCap },
      },
    ],
  },
  {
    title: "FINANCE & GROWTH",
    entries: [
      {
        type: "item",
        item: { href: "/tithes", module: "tithes", label: "Tithes Tracker", icon: CreditCard },
      },
      {
        type: "item",
        item: { href: "/finances", module: "finances", label: "Finance", icon: DollarSign },
      },
      {
        type: "item",
        item: { href: "/welfare-dues", module: "care", label: "Welfare Dues", icon: CreditCard },
      },
      {
        type: "item",
        item: { href: "/giving-analytics", module: "analytics", label: "Giving Analytics", icon: ChartColumn },
      },
      {
        type: "item",
        item: { href: "/growth", module: "analytics", label: "Growth", icon: TrendingUp },
      },
    ],
  },
  {
    title: "EVENTS & CARE",
    entries: [
      {
        type: "item",
        item: { href: "/events", module: "events", label: "Events", icon: Calendar },
      },
      {
        type: "item",
        item: { href: "/attendance", module: "events", label: "Attendance", icon: ClipboardCheck },
      },
      {
        type: "item",
        item: { href: "/welfare", module: "care", label: "Member Care", icon: HeartHandshake },
      },
    ],
  },
  {
    title: "COMMUNICATIONS",
    entries: [
      {
        type: "item",
        item: { href: "/announcements", module: "messaging", label: "Announce", icon: Megaphone },
      },
      {
        type: "item",
        item: { href: "/message-center", module: "messaging", label: "Messages", icon: MessageSquare },
      },
    ],
  },
  {
    title: "ADMINISTRATION & ACCESS",
    entries: [
      {
        type: "group",
        group: {
          label: "Analytics",
          icon: ChartColumn,
          module: "analytics",
          children: [
            { href: "/analytics", label: "Overview" },
            { href: "/analytics?view=activity", label: "Activity Tracker" },
          ],
        },
      },
      {
        type: "group",
        group: {
          label: "Staffs",
          icon: UserCog,
          module: "staffs",
          children: [{ href: "/staffs", label: "Manage Staffs" }],
        },
      },
      {
        type: "item",
        item: { href: "/settings", module: "settings", label: "Settings", icon: Settings },
      },
    ],
  },
];

export const NAV_ENTRIES: NavEntry[] = NAV_CATEGORIES.flatMap((c) => c.entries);

// Backwards-compatible exports
export const NAV: NavItem[] = NAV_ENTRIES.filter((e) => e.type === "item").map((e) => e.item);
export const NAV_GROUPS: NavGroup[] = NAV_ENTRIES.filter((e) => e.type === "group").map((e) => e.group);
