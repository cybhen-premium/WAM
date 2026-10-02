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

export const NAV: NavItem[] = [
  { href: "/dashboard", module: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", module: "members", label: "Members", icon: Users },
  { href: "/departments", module: "members", label: "Departments", icon: Users },
  { href: "/akwaaba", module: "akwaaba", label: "Akwaaba", icon: HandHeart },
  { href: "/sob", module: "sob", label: "SOB", icon: GraduationCap },
  { href: "/tithes", module: "tithes", label: "Tithes Tracker", icon: CreditCard },
  { href: "/finances", module: "finances", label: "Finances", icon: DollarSign },
  { href: "/giving-analytics", module: "analytics", label: "Giving Analytics", icon: ChartColumn },
  { href: "/growth", module: "analytics", label: "Growth", icon: TrendingUp },
  { href: "/events", module: "events", label: "Events", icon: Calendar },
  { href: "/attendance", module: "events", label: "Attendance", icon: ClipboardCheck },
  { href: "/follow-up", module: "care", label: "Follow-up", icon: UserCheck },
  { href: "/welfare", module: "care", label: "Member Care", icon: HeartHandshake },
  { href: "/welfare-dues", module: "care", label: "Welfare Dues", icon: HeartHandshake },
  { href: "/announcements", module: "messaging", label: "Announce", icon: Megaphone },
  { href: "/message-center", module: "messaging", label: "Messages", icon: MessageSquare },
  { href: "/visitor-conversion", module: "analytics", label: "Visitors", icon: TrendingUp },
  { href: "/settings", module: "settings", label: "Settings", icon: Settings },
];

/** Groups that render as collapsible dropdowns in the sidebar. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Staffs",
    icon: UserCog,
    module: "staffs",
    children: [{ href: "/staffs", label: "Manage Staffs" }],
  },
];
