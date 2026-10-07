import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { UserCheck } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { MembersToolbar, MemberFilters, MemberRowActions, MemberProfileCell } from "./members-client";
import { requireModule } from "@/lib/permissions";
import { TablePagination } from "@/components/table-pagination";

export const metadata = { title: "Members Directory" };

const { member } = schema;

export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const { church } = await requireChurch();
  await requireModule("members");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const group = typeof sp.group === "string" ? sp.group : "";
  const departmentId = typeof sp.departmentId === "string" ? sp.departmentId : "";
  const status = sp.status === "inactive" ? "inactive" : "active";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = Math.max(10, Number(sp.pageSize) || 50);

  const filters: (SQL | undefined)[] = [
    eq(member.churchId, church.id),
    eq(member.active, status === "active"),
    // Exclude visitors and regular attendees - only show full members
    sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
  ];
  if (group) filters.push(eq(member.category, group));
  if (departmentId) filters.push(eq(member.departmentId, departmentId));
  if (q) {
    const like = `%${q}%`;
    filters.push(or(ilike(member.fullName, like), ilike(member.phone, like), ilike(member.occupation, like)));
  }

  const [rows, counts, departments, [totalFiltered]] = await Promise.all([
    db
      .select({ member, department: schema.department })
      .from(member)
      .leftJoin(schema.department, eq(member.departmentId, schema.department.id))
      .where(and(...filters))
      .orderBy(asc(member.fullName))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ active: member.active, n: count() })
      .from(member)
      .where(and(eq(member.churchId, church.id), sql`${member.category} not in ('Visitor', 'Regular Attendee')`))
      .groupBy(member.active),
    db
      .select()
      .from(schema.department)
      .where(eq(schema.department.churchId, church.id))
      .orderBy(asc(schema.department.name)),
    db
      .select({ total: count() })
      .from(member)
      .where(and(...filters)),
  ]);
  const activeCount = counts.find((c) => c.active)?.n ?? 0;
  const inactiveCount = counts.find((c) => !c.active)?.n ?? 0;
  const totalFilteredCount = totalFiltered?.total ?? 0;

  return (
    <div className="space-y-5 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Members Directory</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            {activeCount} Active Records
          </p>
        </div>
        <MembersToolbar departments={departments} />
      </div>

      <MemberFilters 
        q={q} 
        group={group} 
        departmentId={departmentId}
        status={status} 
        activeCount={activeCount} 
        inactiveCount={inactiveCount} 
        departments={departments}
      />

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {["Member Profile", "Ministry", "Contact", "Location", "Member Care"].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400 ${i === 0 ? "pl-8" : ""}`}
                >
                  {h}
                </th>
              ))}
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
                    <UserCheck className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium italic">
                      {q || group ? "No members match your filters." : "The member directory is currently empty."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(({ member: m, department: d }) => (
                <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 pl-8 py-3">
                    <MemberProfileCell member={m} department={d} departments={departments} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-slate-600">
                        {m.category}
                      </span>
                      {d && (
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-[#1e3a8a]">
                          {d.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p className="font-semibold">{m.phone ?? "—"}</p>
                    {m.email && <p className="text-xs text-slate-400">{m.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{m.address ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 space-y-0.5">
                    {m.dateOfBirth && <p>🎂 {fmtDay(m.dateOfBirth)}</p>}
                    {m.weddingAnniversary && <p>💍 {fmtDay(m.weddingAnniversary)}</p>}
                    {!m.dateOfBirth && !m.weddingAnniversary && "—"}
                  </td>
                  <td className="px-4 pr-8 py-3 text-right">
                    <MemberRowActions member={m} department={d} departments={departments} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          currentPage={page}
          totalItems={totalFilteredCount}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          useUrlParams={true}
        />
      </div>
    </div>
  );
}

function fmtDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
