import { and, asc, count, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { UserCheck } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { MembersToolbar, MemberFilters, MemberTableRow } from "./members-client";
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
  const duplicate = typeof sp.duplicate === "string" ? sp.duplicate : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = Math.max(10, Number(sp.pageSize) || 50);

  // Optimize duplicate check: run in parallel with main queries unless duplicate filter is actively filtering
  const isDuplicateFilterActive = Boolean(duplicate);

  let duplicateNameIds = new Set<string>();
  let duplicateContactIds = new Set<string>();

  function processDuplicates(membersList: Array<{ id: string; fullName: string; phone: string | null }>) {
    const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const getNameTokens = (s: string) => normalizeName(s).split(" ").filter(Boolean).sort().join(" ");
    const getPhoneCore = (p: string | null) => {
      if (!p) return "";
      const d = p.replace(/\D/g, "");
      return d.length >= 8 ? d.slice(-9) : "";
    };

    const nameCounts = new Map<string, number>();
    const tokenCounts = new Map<string, number>();
    const phoneCounts = new Map<string, number>();

    for (const m of membersList) {
      const norm = normalizeName(m.fullName);
      const tokens = getNameTokens(m.fullName);
      if (norm) nameCounts.set(norm, (nameCounts.get(norm) ?? 0) + 1);
      if (tokens && tokens !== norm) tokenCounts.set(tokens, (tokenCounts.get(tokens) ?? 0) + 1);
      const pc = getPhoneCore(m.phone);
      if (pc) phoneCounts.set(pc, (phoneCounts.get(pc) ?? 0) + 1);
    }

    const nameIds = new Set<string>();
    const contactIds = new Set<string>();

    for (const m of membersList) {
      const norm = normalizeName(m.fullName);
      const tokens = getNameTokens(m.fullName);
      const pc = getPhoneCore(m.phone);
      if (
        (norm && (nameCounts.get(norm) ?? 0) > 1) ||
        (tokens && (tokenCounts.get(tokens) ?? 0) > 1)
      ) {
        nameIds.add(m.id);
      }
      if (pc && (phoneCounts.get(pc) ?? 0) > 1) {
        contactIds.add(m.id);
      }
    }

    return { nameIds, contactIds };
  }

  const fetchAllChurchMembers = () =>
    db
      .select({
        id: member.id,
        fullName: member.fullName,
        phone: member.phone,
      })
      .from(member)
      .where(
        and(
          eq(member.churchId, church.id),
          sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
        ),
      );

  if (isDuplicateFilterActive) {
    const list = await fetchAllChurchMembers();
    const res = processDuplicates(list);
    duplicateNameIds = res.nameIds;
    duplicateContactIds = res.contactIds;
  }

  const filters: (SQL | undefined)[] = [
    eq(member.churchId, church.id),
    eq(member.active, status === "active"),
    sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
  ];
  if (group) filters.push(eq(member.category, group));
  if (departmentId) filters.push(eq(member.departmentId, departmentId));
  if (q) {
    const like = `%${q}%`;
    filters.push(or(ilike(member.fullName, like), ilike(member.phone, like), ilike(member.occupation, like)));
  }

  if (duplicate === "names") {
    const arr = Array.from(duplicateNameIds);
    filters.push(arr.length > 0 ? inArray(member.id, arr) : sql`1 = 0`);
  } else if (duplicate === "contact") {
    const arr = Array.from(duplicateContactIds);
    filters.push(arr.length > 0 ? inArray(member.id, arr) : sql`1 = 0`);
  } else if (duplicate === "any") {
    const arr = Array.from(new Set([...duplicateNameIds, ...duplicateContactIds]));
    filters.push(arr.length > 0 ? inArray(member.id, arr) : sql`1 = 0`);
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
      .where(
        and(
          eq(member.churchId, church.id),
          sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
        ),
      )
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
        duplicate={duplicate}
        duplicateNamesCount={duplicateNameIds.size}
        duplicateContactsCount={duplicateContactIds.size}
        totalDuplicatesCount={new Set([...duplicateNameIds, ...duplicateContactIds]).size}
        activeCount={activeCount} 
        inactiveCount={inactiveCount} 
        departments={departments}
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10.5px] font-black uppercase tracking-wider text-slate-400 select-none">
              <tr>
                <th className="py-2.5 pl-3.5 sm:pl-4 pr-1.5 w-[26%]">Member Profile</th>
                <th className="py-2.5 px-1.5 sm:px-2 w-[12%]">Ministry</th>
                <th className="py-2.5 px-1.5 sm:px-2 w-[14%]">Department</th>
                <th className="py-2.5 px-1.5 sm:px-2 w-[13%]">Contact</th>
                <th className="py-2.5 px-1.5 sm:px-2 w-[11%]">Location</th>
                <th className="py-2.5 px-1.5 sm:px-2 w-[10%]">Celebrations</th>
                <th className="py-2.5 pl-1 pr-3 sm:pr-4 text-right w-[14%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <UserCheck className="h-10 w-10 mb-3 opacity-20" />
                      <p className="text-sm font-medium italic">
                        {q || group || departmentId || duplicate ? "No members match your filters." : "The member directory is currently empty."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map(({ member: m, department: d }) => (
                  <MemberTableRow
                    key={m.id}
                    member={m}
                    department={d}
                    departments={departments}
                    isDuplicateName={duplicateNameIds.has(m.id)}
                    isDuplicateContact={duplicateContactIds.has(m.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
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
