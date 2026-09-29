import { eq, sql, and, gte, lt, notInArray } from "drizzle-orm";
import { Wallet, TrendingUp, CheckCircle2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cedis } from "@/lib/utils";
import { TithesToolbar, TithePeriodDropdown, TitheActions, TitheSearch } from "./client";

export const metadata = { title: "Tithes Tracker" };

/** Visitors and regular attendees are still in the Akwaaba → SOB journey, so they are not full members yet. */
const NON_MEMBER_CATEGORIES: string[] = ["Visitor", "Regular Attendee"];

export default async function TithesPage({ searchParams }: PageProps<"/tithes">) {
  const { church } = await requireChurch();
  const sp = await searchParams;

  // Determine period — "YYYY" (whole year) or "YYYY-MM" (single month), defaults to current year
  const rawPeriod = typeof sp.month === "string" ? sp.month : "";
  const currentYear = String(new Date().getFullYear());
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawPeriod)
    ? rawPeriod
    : /^\d{4}$/.test(rawPeriod)
      ? rawPeriod
      : currentYear;
  const isYear = period.length === 4;

  // Member search — narrows the rows shown; summary cards and the roster counts stay unfiltered.
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  // Year view has no single month — the toolbar (Print Tithers link, Record Tithe default) falls back to the
  // current month; per-row "Record Tithe" buttons use the month of the section they sit in.
  const toolbarMonth = isYear ? new Date().toISOString().slice(0, 7) : period;

  // Tithes are for members only — visitors / regular attendees are still in the Akwaaba → SOB journey.
  const members = await db
    .select({ id: schema.member.id, fullName: schema.member.fullName, category: schema.member.category })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.active, true),
        notInArray(schema.member.category, NON_MEMBER_CATEGORIES),
      )
    )
    .orderBy(schema.member.fullName);

  const search = q.toLowerCase();
  const visibleMembers = search ? members.filter((m) => m.fullName.toLowerCase().includes(search)) : members;

  // Fetch tithes for this period (year or month), joined to the payer so a non-member tithe is never counted.
  // tithes.month is stored as "YYYY-MM", so a year uses a prefix range
  const titheRecords = await db
    .select({
      memberId: schema.tithe.memberId,
      amount: schema.tithe.amount,
      week: schema.tithe.week,
      month: schema.tithe.month,
    })
    .from(schema.tithe)
    .innerJoin(schema.member, eq(schema.tithe.memberId, schema.member.id))
    .where(
      and(
        eq(schema.tithe.churchId, church.id),
        notInArray(schema.member.category, NON_MEMBER_CATEGORIES),
        isYear
          ? and(gte(schema.tithe.month, `${period}-01`), lt(schema.tithe.month, `${Number(period) + 1}-01`))
          : eq(schema.tithe.month, period),
      )
    );

  // Years with at least one member tithe (year dropdown options)
  const yearRows = await db
    .select({ year: sql<string>`substring(${schema.tithe.month} from 1 for 4)` })
    .from(schema.tithe)
    .innerJoin(schema.member, eq(schema.tithe.memberId, schema.member.id))
    .where(
      and(
        eq(schema.tithe.churchId, church.id),
        notInArray(schema.member.category, NON_MEMBER_CATEGORIES),
      )
    )
    .groupBy(sql`substring(${schema.tithe.month} from 1 for 4)`)
    .orderBy(sql`substring(${schema.tithe.month} from 1 for 4)`);
  const years = [...new Set(yearRows.map((r) => r.year).filter(Boolean))].sort().reverse();
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const memberTithes = new Map<string, { [week: number]: number }>();
  const memberMonthTithes = new Map<string, Map<string, { [week: number]: number }>>();
  // Only member tithes reach this point, so the totals match the rows listed below.
  let totalCollected = 0;

  for (const r of titheRecords) {
    if (!memberTithes.has(r.memberId)) memberTithes.set(r.memberId, {});
    const map = memberTithes.get(r.memberId)!;
    const amt = Number(r.amount);
    // In year view, later months overwrite earlier ones per week — the Total column still sums everything correctly.
    // (Year view renders per-month groupings below instead of the weekly grid.)
    map[r.week] = (map[r.week] ?? 0) + amt;
    totalCollected += amt;
    if (isYear) {
      if (!memberMonthTithes.has(r.memberId)) memberMonthTithes.set(r.memberId, new Map());
      const byMonth = memberMonthTithes.get(r.memberId)!;
      if (!byMonth.has(r.month)) byMonth.set(r.month, {});
      const mMap = byMonth.get(r.month)!;
      mMap[r.week] = (mMap[r.week] ?? 0) + amt;
    }
  }

  const monthLabel = isYear
    ? `Year ${period}`
    : new Date(period + "-01").toLocaleString("default", { month: "long", year: "numeric" });
  // Counted against the listed roster so "X of Y members" can never exceed the member count.
  const activeTithers = members.filter((m) => memberTithes.has(m.id)).length;

  // Year view: months present in the data + per-month totals, newest first
  const yearMonths = isYear
    ? [...new Set(titheRecords.map((r) => r.month))].sort().reverse()
    : [];
  const yearMonthTotals = new Map<string, number>();
  for (const r of titheRecords) {
    yearMonthTotals.set(r.month, (yearMonthTotals.get(r.month) ?? 0) + Number(r.amount));
  }
  // While searching, only the months that have a matching tither are listed.
  const shownMonths = q
    ? yearMonths.filter((ym) => visibleMembers.some((m) => memberMonthTithes.get(m.id)?.get(ym)))
    : yearMonths;

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Tithes Tracker</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            Weekly tithe collection · members only
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Card period selector + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TithePeriodDropdown currentPeriod={period} years={years} />
          <TithesToolbar month={toolbarMonth} members={members.map((m) => ({ id: m.id, name: m.fullName }))} />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryCard
            label="Month"
            value={monthLabel}
            sub=""
            tone="text-slate-700"
            icon={TrendingUp}
          />
          <SummaryCard
            label="Total Tithes"
            value={cedis(totalCollected)}
            sub={isYear ? "Collected this year" : "Collected this month"}
            tone="text-emerald-600"
            icon={Wallet}
          />
          <SummaryCard
            label="Active Tithers"
            value={`${activeTithers}`}
            sub={`of ${members.length} full members`}
            tone="text-blue-600"
            icon={CheckCircle2}
          />
        </div>

        {/* List period selector + member search — sits directly above the list */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
          <TithePeriodDropdown currentPeriod={period} years={years} />
          <TitheSearch q={q} />
        </div>

        {/* Member table */}
        {isYear ? (
          <div className="space-y-4">
            {members.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400 text-sm italic">
                No full members found.
              </div>
            ) : q && visibleMembers.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400 text-sm italic">
                No members match “{q}”.
              </div>
            ) : shownMonths.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400 text-sm italic">
                {q ? `No tithes recorded for “${q}” in ${period}.` : `No tithes recorded in ${period} yet.`}
              </div>
            ) : (
              shownMonths.map((ym) => {
                const label = new Date(ym + "-01").toLocaleString("default", { month: "long", year: "numeric" });
                const tithers = visibleMembers.filter((m) => (memberMonthTithes.get(m.id)?.get(ym) ? true : false));
                // While searching, the header total covers the rows shown so the two always agree.
                const monthTotal = q
                  ? tithers.reduce((sum, m) => {
                      const w = memberMonthTithes.get(m.id)?.get(ym) ?? {};
                      return sum + (w[1] || 0) + (w[2] || 0) + (w[3] || 0) + (w[4] || 0) + (w[5] || 0);
                    }, 0)
                  : (yearMonthTotals.get(ym) ?? 0);
                return (
                  <div key={ym} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
                    <div className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-700">{label}</p>
                      <p className="text-xs font-black text-emerald-600">
                        {cedis(monthTotal)} · {tithers.length} tither{tithers.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 pl-8 h-14 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400 min-w-[200px]">
                            Member
                          </th>
                          <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            Week 1
                          </th>
                          <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            Week 2
                          </th>
                          <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            Week 3
                          </th>
                          <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            Week 4
                          </th>
                          <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            Week 5
                          </th>
                          <th className="px-4 h-14 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            Total
                          </th>
                          <th className="px-4 pr-8 h-14 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tithers.map((m) => {
                          const weeks = memberMonthTithes.get(m.id)?.get(ym) ?? {};
                          const total = (weeks[1]||0) + (weeks[2]||0) + (weeks[3]||0) + (weeks[4]||0) + (weeks[5]||0);
                          return (
                            <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 pl-8 py-3.5">
                                <p className="font-bold text-slate-900">{m.fullName}</p>
                                <p className="text-[10px] font-bold uppercase text-slate-400">{m.category}</p>
                              </td>
                              {[1, 2, 3, 4, 5].map(week => (
                                <td key={week} className="px-4 py-3.5 text-center">
                                  {weeks[week] ? (
                                    <span className="inline-flex items-center justify-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-700 w-full min-w-[60px]">
                                      {cedis(weeks[week])}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400 w-full min-w-[60px]">
                                      —
                                    </span>
                                  )}
                                </td>
                              ))}
                              <td className="px-4 py-3.5 text-right font-black text-slate-700">
                                {total > 0 ? cedis(total) : "—"}
                              </td>
                              <td className="px-4 pr-8 py-3.5 text-right">
                                <TitheActions memberId={m.id} memberName={m.fullName} month={ym} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>
        ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 pl-8 h-14 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400 min-w-[200px]">
                  Member
                </th>
                <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Week 1
                </th>
                <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Week 2
                </th>
                <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Week 3
                </th>
                <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Week 4
                </th>
                <th className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Week 5
                </th>
                <th className="px-4 h-14 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Total
                </th>
                <th className="px-4 pr-8 h-14 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-40 text-center text-slate-400 text-sm italic">
                    {q ? `No members match “${q}”.` : "No full members found."}
                  </td>
                </tr>
              ) : (
                visibleMembers.map((m) => {
                  const weeks = memberTithes.get(m.id) ?? {};
                  const total = (weeks[1]||0) + (weeks[2]||0) + (weeks[3]||0) + (weeks[4]||0) + (weeks[5]||0);

                  return (
                    <tr
                      key={m.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 pl-8 py-3.5">
                        <p className="font-bold text-slate-900">{m.fullName}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-400">{m.category}</p>
                      </td>
                      {[1, 2, 3, 4, 5].map(week => (
                        <td key={week} className="px-4 py-3.5 text-center">
                          {weeks[week] ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-700 w-full min-w-[60px]">
                              {cedis(weeks[week])}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400 w-full min-w-[60px]">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3.5 text-right font-black text-slate-700">
                        {total > 0 ? cedis(total) : "—"}
                      </td>
                      <td className="px-4 pr-8 py-3.5 text-right">
                        <TitheActions memberId={m.id} memberName={m.fullName} month={period} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className={`text-lg font-black ${tone} truncate`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
