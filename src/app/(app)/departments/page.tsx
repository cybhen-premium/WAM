import { and, asc, count, eq } from "drizzle-orm";
import { Users, KeyRound, ExternalLink, CheckCircle2, Clock, Calendar } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { DepartmentToolbar, DepartmentRowActions } from "./client";
import { TablePagination } from "@/components/table-pagination";
import { requireModule } from "@/lib/permissions";
import Link from "next/link";

export const metadata = { title: "Departments" };

function getRecentSunday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 is Sunday
  const diff = day === 0 ? 0 : day;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default async function DepartmentsPage({ searchParams }: PageProps<"/departments">) {
  const { church, role } = await requireChurch();
  await requireModule("members");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp?.page) || 1);
  const pageSize = Math.max(1, Number(sp?.pageSize) || 50);

  const recentSunday = getRecentSunday();

  const [rows, memberCounts, staffRows, sundayAttendanceRows] = await Promise.all([
    db
      .select({
        id: schema.department.id,
        name: schema.department.name,
        createdAt: schema.department.createdAt,
      })
      .from(schema.department)
      .where(eq(schema.department.churchId, church.id))
      .orderBy(asc(schema.department.name)),
    db
      .select({
        departmentId: schema.member.departmentId,
        count: count(),
      })
      .from(schema.member)
      .where(eq(schema.member.churchId, church.id))
      .groupBy(schema.member.departmentId),
    db
      .select({
        id: schema.staff.id,
        email: schema.staff.email,
        departmentId: schema.staff.departmentId,
      })
      .from(schema.staff)
      .where(eq(schema.staff.churchId, church.id)),
    db
      .select({
        departmentId: schema.attendance.departmentId,
        status: schema.attendance.status,
        count: count(),
      })
      .from(schema.attendance)
      .where(
        and(
          eq(schema.attendance.churchId, church.id),
          eq(schema.attendance.serviceDate, recentSunday),
        ),
      )
      .groupBy(schema.attendance.departmentId, schema.attendance.status),
  ]);

  const countMap = new Map<string, number>();
  for (const m of memberCounts) {
    if (m.departmentId) countMap.set(m.departmentId, m.count);
  }

  const staffMap = new Map<string, { id: string; email: string }>();
  for (const s of staffRows) {
    if (s.departmentId) staffMap.set(s.departmentId, { id: s.id, email: s.email });
  }

  // Map attendance for recent Sunday: departmentId -> { present, absent, recorded }
  const sundayMap = new Map<string, { present: number; absent: number }>();
  for (const a of sundayAttendanceRows) {
    if (a.departmentId) {
      const cur = sundayMap.get(a.departmentId) || { present: 0, absent: 0 };
      if (a.status === "present") cur.present += a.count;
      else if (a.status === "absent") cur.absent += a.count;
      sundayMap.set(a.departmentId, cur);
    }
  }

  const submittedCount = rows.filter((d) => sundayMap.has(d.id)).length;
  const pendingCount = rows.length - submittedCount;
  const totalMembers = Array.from(countMap.values()).reduce((a, b) => a + b, 0);

  const formattedSunday = new Date(recentSunday + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Departments</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            {rows.length} Departments · Manage members, attendance accounts & portals
          </p>
        </div>
        <DepartmentToolbar />
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Departments
          </span>
          <p className="mt-2 text-2xl font-black text-slate-900">{rows.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalMembers} assigned members</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
            Sunday Attendance ({formattedSunday})
          </span>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {submittedCount} <span className="text-xs font-bold text-slate-400">/ {rows.length} Submitted</span>
          </p>
          <p className="text-xs text-emerald-600 font-bold mt-0.5">
            {submittedCount === rows.length && rows.length > 0 ? "All departments submitted" : `${submittedCount} completed`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
            Pending Submissions
          </span>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {pendingCount}{" "}
            <span className="text-xs font-bold text-slate-400">
              {pendingCount === 1 ? "Department" : "Departments"}
            </span>
          </p>
          <p className="text-xs text-amber-600 font-bold mt-0.5">
            {pendingCount > 0 ? "Awaiting Sunday attendance checklist" : "No pending submissions"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-4 pl-8 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Department Name
              </th>
              <th className="px-4 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Assigned Members
              </th>
              <th className="px-4 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Sunday Attendance ({formattedSunday})
              </th>
              <th className="px-4 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Login Account
              </th>
              <th className="px-4 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Portal
              </th>
              <th className="px-4 pr-8 h-16 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Users className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium italic">No departments have been added yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.slice((page - 1) * pageSize, page * pageSize).map((d) => {
                const memberCount = countMap.get(d.id) ?? 0;
                const assignedStaff = staffMap.get(d.id);
                const attendanceStatus = sundayMap.get(d.id);
                return (
                  <tr
                    key={d.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 pl-8 py-4 font-bold text-slate-900">
                      <Link href={`/members?departmentId=${d.id}`} className="hover:text-blue-600 hover:underline">
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/members?departmentId=${d.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <Users className="h-3 w-3" /> {memberCount} {memberCount === 1 ? "member" : "members"}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      {attendanceStatus ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Submitted ({attendanceStatus.present} Present, {attendanceStatus.absent} Absent)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800">
                          <Clock className="h-3.5 w-3.5" /> Pending Submission
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {assignedStaff ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800">
                            <KeyRound className="h-3 w-3" /> {assignedStaff.email}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          No Account
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/department-portal?deptId=${d.id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1 text-xs font-black text-[#1e3a8a] hover:bg-blue-100 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Open Portal
                      </Link>
                    </td>
                    <td className="px-4 pr-8 py-4 text-right">
                      <DepartmentRowActions
                        department={d}
                        assignedEmail={assignedStaff?.email}
                        isAdmin={role === "admin"}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <TablePagination
          currentPage={page}
          totalItems={rows.length}
          pageSize={pageSize}
          useUrlParams={true}
        />
      </div>
    </div>
  );
}
