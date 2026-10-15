import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { DepartmentPortalClient } from "./portal-client";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Department Portal" };

function getRecentSunday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 is Sunday
  const diff = day === 0 ? 0 : day; // if today is Sunday, today; otherwise past Sunday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default async function DepartmentPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ deptId?: string; date?: string; tab?: string }>;
}) {
  const ctx = await requireChurch();
  await requireModule("department_portal");
  const { church, user, role, departmentId } = ctx;
  const sp = await searchParams;

  const { getMyPermissions } = await import("@/lib/permissions");
  const perms = await getMyPermissions();
  const isAdminPortal = role === "admin" || perms === "all" || (perms instanceof Set && perms.has("department_portal"));

  // If user is neither admin/department_portal holder NOR assigned to a department, 404
  if (!isAdminPortal && !departmentId) {
    const { notFound } = await import("next/navigation");
    notFound();
  }

  // 1. Fetch departments available in the church
  const allDepartments = await db
    .select({ id: schema.department.id, name: schema.department.name })
    .from(schema.department)
    .where(eq(schema.department.churchId, church.id))
    .orderBy(asc(schema.department.name));

  if (allDepartments.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-[#1e3a8a] mb-4">
          <Building2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">No Departments Found</h1>
        <p className="mt-2 text-sm text-slate-500">
          Create church departments first to assign members and take attendance.
        </p>
        {isAdminPortal && (
          <Link
            href="/departments"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-900"
          >
            <Plus className="h-4 w-4" /> Go to Departments
          </Link>
        )}
      </div>
    );
  }

  // 2. Resolve target department
  let activeDept = allDepartments[0];
  if (!isAdminPortal && departmentId) {
    // Non-admin department lead: strictly locked to their assigned department
    const matched = allDepartments.find((d) => d.id === departmentId);
    if (!matched) {
      const { notFound } = await import("next/navigation");
      notFound();
    }
    activeDept = matched!;
  } else if (sp.deptId) {
    const matched = allDepartments.find((d) => d.id === sp.deptId);
    if (matched) activeDept = matched;
  } else if (departmentId) {
    const matched = allDepartments.find((d) => d.id === departmentId);
    if (matched) activeDept = matched;
  }

  // 3. Resolve selected date
  const selectedDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : getRecentSunday();

  // 4. Fetch members assigned to this department
  const deptMembers = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      category: schema.member.category,
      phone: schema.member.phone,
      email: schema.member.email,
      gender: schema.member.gender,
      lastAttendedAt: schema.member.lastAttendedAt,
      photoUrl: schema.member.photoUrl,
      joinedAt: schema.member.joinedAt,
    })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.departmentId, activeDept.id),
        eq(schema.member.active, true),
      ),
    )
    .orderBy(asc(schema.member.fullName));

  // 5. Fetch attendance for this specific date
  const dateAttendance = await db
    .select({
      memberId: schema.attendance.memberId,
      status: schema.attendance.status,
      notes: schema.attendance.notes,
    })
    .from(schema.attendance)
    .where(
      and(
        eq(schema.attendance.churchId, church.id),
        eq(schema.attendance.departmentId, activeDept.id),
        eq(schema.attendance.serviceDate, selectedDate),
      ),
    );

  // 6. Fetch historical attendance records for charts (grouped by date)
  const historyRaw = await db
    .select({
      serviceDate: schema.attendance.serviceDate,
      status: schema.attendance.status,
      count: count(),
    })
    .from(schema.attendance)
    .where(
      and(
        eq(schema.attendance.churchId, church.id),
        eq(schema.attendance.departmentId, activeDept.id),
      ),
    )
    .groupBy(schema.attendance.serviceDate, schema.attendance.status)
    .orderBy(desc(schema.attendance.serviceDate))
    .limit(30);

  // Aggregate history by date
  const historyByDateMap = new Map<
    string,
    { date: string; present: number; absent: number; total: number; rate: number }
  >();

  for (const row of historyRaw) {
    const existing = historyByDateMap.get(row.serviceDate) || {
      date: row.serviceDate,
      present: 0,
      absent: 0,
      total: 0,
      rate: 0,
    };
    if (row.status === "present") existing.present += row.count;
    else if (row.status === "absent") existing.absent += row.count;
    existing.total = existing.present + existing.absent;
    existing.rate =
      existing.total > 0 ? Math.round((existing.present / existing.total) * 100) : 0;
    historyByDateMap.set(row.serviceDate, existing);
  }

  // Sorted chronologically for charts
  const historyData = Array.from(historyByDateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // 7. Member attendance consistency (last 4 records in this department)
  const memberAttendanceCounts = await db
    .select({
      memberId: schema.attendance.memberId,
      status: schema.attendance.status,
      count: count(),
    })
    .from(schema.attendance)
    .where(
      and(
        eq(schema.attendance.churchId, church.id),
        eq(schema.attendance.departmentId, activeDept.id),
        sql`${schema.attendance.serviceDate} >= current_date - interval '35 days'`,
      ),
    )
    .groupBy(schema.attendance.memberId, schema.attendance.status);

  const memberStatsMap: Record<string, { present: number; absent: number }> = {};
  for (const row of memberAttendanceCounts) {
    if (!memberStatsMap[row.memberId]) {
      memberStatsMap[row.memberId] = { present: 0, absent: 0 };
    }
    if (row.status === "present") memberStatsMap[row.memberId].present += row.count;
    if (row.status === "absent") memberStatsMap[row.memberId].absent += row.count;
  }

  return (
    <div className="space-y-6 pb-6 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <DepartmentPortalClient
        department={activeDept}
        allDepartments={isAdminPortal ? allDepartments : []}
        selectedDate={selectedDate}
        members={deptMembers}
        dateAttendance={dateAttendance}
        historyData={historyData}
        memberStatsMap={memberStatsMap}
        initialTab={sp.tab || "attendance"}
        churchName={church.name}
        absenceTemplate={
          church.absenceTemplate ||
          "Hello [Name], we missed you at church today! We prayed for you and look forward to seeing you next Sunday. Have a blessed week!"
        }
        isAdmin={isAdminPortal}
      />
    </div>
  );
}
