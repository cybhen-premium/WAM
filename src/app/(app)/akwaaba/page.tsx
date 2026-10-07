import { eq, and, ilike, asc, count, sql, gte, lt, or, isNull, ne, type SQL } from "drizzle-orm";
import { HandHeart, Users, UserCheck } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AkwaabaHeader, AkwaabaFilters, PersonRowActions } from "./client";
import { requireModule } from "@/lib/permissions";
import { TablePagination } from "@/components/table-pagination";

export const metadata = { title: "Akwaaba - Reception" };

export default async function AkwaabaPage({ searchParams }: PageProps<"/akwaaba">) {
  const { church } = await requireChurch();
  await requireModule("akwaaba");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = Math.max(10, Number(sp.pageSize) || 50);

  // Year the cards fall back to when ?period is missing/invalid.
  const currentYear = String(new Date().getFullYear());

  /** "YYYY" | "YYYY-MM" — validated, defaults to the current year. */
  function parseSelection(v: unknown): string {
    if (typeof v === "string") {
      if (/^\d{4}$/.test(v)) return v;
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
    }
    return currentYear;
  }
  const period = parseSelection(sp.period);

  // Akwaaba lists everyone received through reception — `fromAkwaaba`, not the category: baptism later
  // moves a person to "General Member" and they must stay on this list. The two *current* reception
  // statuses below are what the status filter and the Status column work from.

  /** Date window a registration must fall in for the selected period ("YYYY" or "YYYY-MM"). */
  function receptionRange(sel: string) {
    if (sel.length === 4) {
      const y = Number(sel);
      return { start: `${y}-01-01`, end: new Date(Date.UTC(y + 1, 0, 1)).toISOString().slice(0, 10) };
    }
    const [y, m] = sel.split("-").map(Number);
    return { start: `${sel}-01`, end: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) };
  }
  const range = receptionRange(period);

  // The year/month combo box filters the table *and* the cards — both show what was received in it.
  const tableFilters: (SQL | undefined)[] = [
    eq(schema.member.churchId, church.id),
    eq(schema.member.fromAkwaaba, true),
    gte(schema.member.joinedAt, range.start),
    lt(schema.member.joinedAt, range.end),
  ];
  if (status === "visiting") {
    tableFilters.push(
      or(
        eq(schema.member.akwaabaStatus, "visiting"),
        sql`${schema.member.convertedAt} is not null`,
        and(isNull(schema.member.akwaabaStatus), eq(schema.member.category, "Visitor"))
      )
    );
  }
  if (status === "staying") {
    tableFilters.push(
      and(
        sql`${schema.member.convertedAt} is null`,
        or(
          eq(schema.member.akwaabaStatus, "staying"),
          and(isNull(schema.member.akwaabaStatus), ne(schema.member.category, "Visitor"))
        )
      )
    );
  }
  if (q) tableFilters.push(ilike(schema.member.fullName, `%${q}%`));

  // Cards use the same period window as the table (search / status only narrow the table itself)
  const cardFilters: (SQL | undefined)[] = [
    eq(schema.member.churchId, church.id),
    eq(schema.member.fromAkwaaba, true),
    gte(schema.member.joinedAt, range.start),
    lt(schema.member.joinedAt, range.end),
  ];

  // Years with at least one registration (year dropdown options)
  const [rows, counts, yearRows, departments, [totalFiltered]] = await Promise.all([
    db
      .select()
      .from(schema.member)
      .where(and(...tableFilters))
      .orderBy(asc(schema.member.fullName))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({
        category: schema.member.category,
        akwaabaStatus: schema.member.akwaabaStatus,
        convertedAt: schema.member.convertedAt,
        n: count(),
      })
      .from(schema.member)
      .where(and(...cardFilters))
      .groupBy(schema.member.category, schema.member.akwaabaStatus, schema.member.convertedAt),
    // Years with at least one registration (unfiltered, for dropdown options)
    db
      .select({
        year: sql<string>`to_char(${schema.member.joinedAt}, 'YYYY')`,
      })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.churchId, church.id),
          eq(schema.member.fromAkwaaba, true),
        ),
      )
      .groupBy(sql`to_char(${schema.member.joinedAt}, 'YYYY')`)
      .orderBy(sql`to_char(${schema.member.joinedAt}, 'YYYY')`),
    db
      .select({ id: schema.department.id, name: schema.department.name })
      .from(schema.department)
      .where(eq(schema.department.churchId, church.id))
      .orderBy(asc(schema.department.name)),
    db
      .select({ total: count() })
      .from(schema.member)
      .where(and(...tableFilters)),
  ]);

  const totalFilteredCount = totalFiltered?.total ?? 0;

  const years = [...new Set(yearRows.map((r) => r.year).filter(Boolean))].sort().reverse();
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const isVisitingRow = (c: { category: string; akwaabaStatus: string | null; convertedAt?: string | null }) =>
    c.akwaabaStatus === "visiting" || !!c.convertedAt || (!c.akwaabaStatus && c.category === "Visitor");

  const visitingCount = counts.filter(isVisitingRow).reduce((sum, c) => sum + c.n, 0);
  const stayingCount = counts.filter((c) => !isVisitingRow(c)).reduce((sum, c) => sum + c.n, 0);
  const totalCount = visitingCount + stayingCount;
  const periodHint =
    period.length === 4
      ? period
      : new Date(period + "-01").toLocaleDateString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      {/* Print opens the report for the month being viewed (the report page can change it). */}
      <AkwaabaHeader
        printHref={`/print/akwaaba?month=${period.length === 7 ? period : new Date().toISOString().slice(0, 7)}&group=all`}
        departments={departments}
      />

      {/* The year/month combo box sits in the filter bar above the table and drives the cards too */}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Visiting"
          value={visitingCount}
          sub="guests and visitors"
          hint={periodHint}
          icon={Users}
          tone="text-blue-600 bg-blue-50"
        />
        <StatCard
          label="Staying"
          value={stayingCount}
          sub="regular attendees"
          hint={periodHint}
          icon={UserCheck}
          tone="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Total Registered"
          value={totalCount}
          sub="received through Akwaaba"
          hint={periodHint}
          icon={HandHeart}
          tone="text-orange-600 bg-orange-50"
        />
      </div>



      <AkwaabaFilters q={q} status={status} period={period} years={years} />

      {/* Result count hint — always names the period the table is showing */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest -mt-2">
        Showing {rows.length} {rows.length === 1 ? "person" : "people"} received in {periodHint}
        {q || status ? " matching your filters" : ""}
      </p>

      {/* People table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {["Person Profile", "Gender", "Contact", "Location", "Department", "Invited By", "Status"].map((h, i) => (
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
                <td colSpan={8} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <HandHeart className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium italic">
                      {q || status
                        ? `No people match your filters for ${periodHint}.`
                        : `No one was received in ${periodHint}.`}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((person) => (
                <tr key={person.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 pl-8 py-3">
                    <div className="flex items-center gap-3">
                      {person.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={person.photoUrl}
                          alt={person.fullName}
                          className="h-10 w-10 shrink-0 rounded-2xl object-cover border border-slate-200 shadow-sm"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 text-xs font-black">
                          {initials(person.fullName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{person.fullName}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Joined: {person.joinedAt ? new Date(person.joinedAt).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize text-xs">
                    {person.gender ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p className="font-semibold">{person.phone ?? "—"}</p>
                    {person.email && <p className="text-xs text-slate-400">{person.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{person.address ?? "—"}</td>
                  <td className="px-4 py-3 max-w-[150px] truncate">
                    {(() => {
                      const dept = departments.find((d) => d.id === person.departmentId);
                      return dept ? (
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-tight text-[#1e3a8a]">
                          {dept.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{person.invitedBy ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const isVisiting = person.akwaabaStatus === "visiting" || person.convertedAt !== null || (!person.akwaabaStatus && person.category === "Visitor");
                      return (
                        <span className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tight",
                          isVisiting ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {isVisiting ? "Visiting" : "Staying"}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 pr-8 py-3 text-right">
                    <PersonRowActions person={person} departments={departments} />
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function StatCard({
  label,
  value,
  sub,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  hint: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <div className="rounded-[2rem] bg-white shadow-xl shadow-slate-200/60 p-6">
      <div className="flex items-start justify-between">
        <div>
          <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase", tone)}>
            {label}
          </span>
          <p className="mt-2 text-5xl font-black text-slate-900">{value}</p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{sub}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-300">{hint}</p>
    </div>
  );
}
