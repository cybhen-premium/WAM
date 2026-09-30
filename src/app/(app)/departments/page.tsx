import { asc, eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { DepartmentToolbar, DepartmentRowActions } from "./client";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const { church } = await requireChurch();
  await requireModule("members");

  const rows = await db
    .select({
      id: schema.department.id,
      name: schema.department.name,
      createdAt: schema.department.createdAt,
    })
    .from(schema.department)
    .where(eq(schema.department.churchId, church.id))
    .orderBy(asc(schema.department.name));

  return (
    <div className="space-y-5 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Departments</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            {rows.length} Departments
          </p>
        </div>
        <DepartmentToolbar />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-4 pl-8 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Department Name
              </th>
              <th className="px-4 pr-8 h-16 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Users className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium italic">No departments have been added yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 pl-8 py-4 font-bold text-slate-900">
                    <a href={`/members?departmentId=${d.id}`} className="hover:text-blue-600 hover:underline">
                      {d.name}
                    </a>
                  </td>
                  <td className="px-4 pr-8 py-4 text-right">
                    <DepartmentRowActions department={d} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
