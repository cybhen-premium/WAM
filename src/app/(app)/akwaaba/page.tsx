import { eq, and, ilike, asc, count, sql, gte, lt } from "drizzle-orm";
import { HandHeart, Users, UserCheck, ChevronDown } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { parsePeriod } from "@/lib/finance";
import { AkwaabaHeader, AkwaabaFilters, PersonRowActions, PeriodDropdown } from "./client";

export const metadata = { title: "Akwaaba - Reception" };

export default async function AkwaabaPage({ searchParams }: PageProps<"/akwaaba">) {
  const { church } = await requireChurch();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const period = parsePeriod(sp.period);

  // Table filters: search + status only (no period — table always shows everyone)
  const tableFilters: any[] = [eq(schema.member.churchId, church.id)];
  if (status === "visiting") tableFilters.push(eq(schema.member.category, "Visitor"));
  if (status === "staying") tableFilters.push(eq(schema.member.category, "Regular Attendee"));
  if (q) tableFilters.push(ilike(schema.member.fullName, `%${q}%`));

  // Card filters: period only (for stat cards)
  const cardFilters: any[] = [eq(schema.member.churchId, church.id)];
  if (period !== "all") {
    let start: string;
    let end: string;
    if (period.length === 4) {
      const y = Number(period);
      start = `${y}-01-01`;
      end = new Date(Date.UTC(y + 1, 0, 1)).toISOString().slice(0, 10);
    } else {
      const [y, m] = period.split("-").map(Number);
      start = `${period}-01`;
      end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    }
    cardFilters.push(and(gte(schema.member.joinedAt, start), lt(schema.member.joinedAt, end)));
  }

  const [rows, counts, allMonths] = await Promise.all([
    db
      .select()
      .from(schema.member)
      .where(and(...tableFilters))
      .orderBy(asc(schema.member.fullName))
      .limit(500),
    db
      .select({ category: schema.member.category, n: count() })
      .from(schema.member)
      .where(and(...cardFilters))
      .groupBy(schema.member.category),
    // Always fetch all months (unfiltered) so dropdown options are always shown
    db
      .select({
        month: sql<string>`to_char(${schema.member.joinedAt}, 'YYYY-MM')`,
        n: count(),
      })
      .from(schema.member)
      .where(eq(schema.member.churchId, church.id))
      .groupBy(sql`to_char(${schema.member.joinedAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${schema.member.joinedAt}, 'YYYY-MM')`),
  ]);

  const visitingCount = counts.find((c) => c.category === "Visitor")?.n ?? 0;
  const stayingCount = counts.find((c) => c.category === "Regular Attendee")?.n ?? 0;
  const totalCount = rows.length;
  const periodHint = period === "all"
    ? "All Time"
    : period.length === 4
      ? period
      : new Date(period + "-01").toLocaleDateString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <AkwaabaHeader />

      {/* Period dropdown for card stats */}
      <PeriodDropdown currentPeriod={period} months={allMonths} />

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
          sub="people in system"
          hint={periodHint}
          icon={HandHeart}
          tone="text-orange-600 bg-orange-50"
        />
      </div>



      <AkwaabaFilters q={q} status={status} />

      {/* Result count hint */}
      {(q || status) && (
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest -mt-2">
          Showing {rows.length} people
        </p>
      )}

      {/* People table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {["Person Profile", "Gender", "Contact", "Location", "Invited By", "Status"].map((h, i) => (
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
                    <HandHeart className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium italic">
                      {q || status ? "No people match your filters." : "No people registered yet."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((person) => (
                <tr key={person.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 pl-8 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 text-xs font-black">
                        {initials(person.fullName)}
                      </div>
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
                  <td className="px-4 py-3 text-slate-600 text-xs">{person.invitedBy ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${
                      person.category === "Visitor" 
                        ? "bg-blue-50 text-blue-600" 
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {person.category === "Visitor" ? "Visiting" : "Staying"}
                    </span>
                  </td>
                  <td className="px-4 pr-8 py-3 text-right">
                    <PersonRowActions person={person} />
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
