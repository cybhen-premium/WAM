import type { ModuleKey } from "@/lib/modules";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  ChartColumn,
  TrendingUp,
  CreditCard,


  HeartHandshake,
  Megaphone,
  MessageSquare,
  GraduationCap,
  Settings,
  HandHeart,
  UserCog,
  Building2,
  Compass,
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

/** Categorized sidebar navigation arranged cleanly and cohesively */
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
        item: { href: "/departments", module: "departments", label: "Departments", icon: Building2 },
      },
      {
        type: "item",
        item: { href: "/department-portal", module: "department_portal", label: "Department Portal", icon: Building2 },
      },
      {
        type: "item",
        item: { href: "/akwaaba", module: "akwaaba", label: "Akwaaba Intake", icon: HandHeart },
      },
      {
        type: "item",
        item: { href: "/visitor-conversion", module: "visitors", label: "Visitors", icon: TrendingUp },
      },
      {
        type: "item",
        item: { href: "/sob", module: "sob", label: "School of Baptism", icon: GraduationCap },
      },
      {
        type: "item",
        item: { href: "/shepherds", module: "shepherds", label: "Shepherds & Disciples", icon: Compass },
      },
    ],
  },
  {
    title: "FINANCE & GIVING",
    entries: [
      {
        type: "item",
        item: { href: "/tithes", module: "tithes", label: "Tithes Tracker", icon: CreditCard },
      },
      {
        type: "item",
        item: { href: "/finances", module: "finances", label: "Finance & Accounts", icon: DollarSign },
      },
      {
        type: "item",
        item: { href: "/welfare-dues", module: "welfare_dues", label: "Welfare Dues", icon: CreditCard },
      },
      {
        type: "item",
        item: { href: "/giving-analytics", module: "giving_analytics", label: "Giving Analytics", icon: ChartColumn },
      },
      {
        type: "item",
        item: { href: "/growth", module: "growth", label: "Growth Trends", icon: TrendingUp },
      },
    ],
  },
  {
    title: "CARE & COMMUNICATIONS",
    entries: [
      {
        type: "item",
        item: { href: "/welfare", module: "welfare", label: "Member Care", icon: HeartHandshake },
      },
      {
        type: "item",
        item: { href: "/announcements", module: "announcements", label: "Announcements", icon: Megaphone },
      },
      {
        type: "item",
        item: { href: "/message-center", module: "messaging", label: "SMS Messages", icon: MessageSquare },
      },
    ],
  },
  {
    title: "ADMINISTRATION",
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
        type: "item",
        item: { href: "/staffs", module: "staffs", label: "Staff Management", icon: UserCog },
      },
      {
        type: "item",
        item: { href: "/settings", module: "settings", label: "System Settings", icon: Settings },
      },
    ],
  },
];

export const NAV_ENTRIES: NavEntry[] = NAV_CATEGORIES.flatMap((c) => c.entries);

// Backwards-compatible exports
export const NAV: NavItem[] = NAV_ENTRIES.filter((e) => e.type === "item").map((e) => e.item);
export const NAV_GROUPS: NavGroup[] = NAV_ENTRIES.filter((e) => e.type === "group").map((e) => e.group);
