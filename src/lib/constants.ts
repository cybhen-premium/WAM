export const MINISTRY_CATEGORIES = [
  "General Member",
  "Choir",
  "Deacon",
  "Deaconess",
  "Elder",
  "Pastor",
  "Media Team",
  "Gadites",
  "Angels",
  "Sunday School Instructors",
  "WAM Choreo/Drama",
  "Team Wise",
  "Prayer Warriors",
  "Akwaaba",
  "Secretary",
] as const;

export const MEMBER_CATEGORIES = [
  ...MINISTRY_CATEGORIES,
  "Children",
  "Regular Attendee",
  "Visitor",
] as const;

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;

export const INCOME_CATEGORIES = ["Offering", "Seed Sowing", "Project Fund", "Other"] as const;
export const EXPENSE_CATEGORIES = [
  "Salaries",
  "Utilities",
  "Rent",
  "Maintenance",
  "Welfare Support",
  "Guest Honorarium",
  "Evangelism",
  "Other",
] as const;
export const TITHE = "Tithe";
export const WELFARE_DUES = "Welfare Dues";
export const WELFARE_SUPPORT = "Welfare Support";
export const WELFARE_CATEGORIES = [WELFARE_DUES, WELFARE_SUPPORT] as const;
export const WELFARE_MONTHLY_TARGET = 20;

