import { eq, sql, and, gte, lt, notInArray } from "drizzle-orm";
import { Wallet, TrendingUp, CheckCircle2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cedis } from "@/lib/utils";
import { weekColumns } from "@/lib/weeks";
import { TithesToolbar, TithePeriodDropdown, TitheActions, TitheSearch } from "./client";

export const metadata = { title: "Tithes Tracker" };

/** Visitors and regular attendees are still in the Akwaaba → SOB journey, so they are not full members yet. */
const NON_MEMBER_CATEGORIES: string[] = ["Visitor", "Regular Attendee"];

/** "YYYY" (whole year) or "YYYY-MM" (single month), else `fallback` (the current year). */
function parsePeriodParam(v: unknown, fallback: string): string {
  if (typeof v === "string") {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
    if (/^\d{4}$/.test(v)) return v;
  }
  return fallback;
}

/**
 * Tithe rows for a "YYYY" year or "YYYY-MM" month, joined to the payer so a non-member tithe is never
 * counted. tithes.month is stored as "YYYY-MM", so a year uses a prefix range.
 */
function titheRecordsFor(churchId: string, period: string) {
  return db
    .select({
      id: schema.tithe.id,
      memberId: schema.tithe.memberId,
      amount: schema.tithe.amount,
      week: schema.tithe.week,
      month: schema.tithe.month,
    })
    .from(schema.tithe)
    .innerJoin(schema.member, eq(schema.tithe.memberId, schema.member.id))
    .where(
      and(
        eq(schema.tithe.churchId, churchId),
        notInArray(schema.member.category, NON_MEMBER_CATEGORIES),
        period.length === 4
          ? and(gte(schema.tithe.month, `${period}-01`), lt(schema.tithe.month, `${Number(period) + 1}-01`))
          : eq(schema.tithe.month, period),
      )
    );
}

export default async function TithesPage({ searchParams }: PageProps<"/tithes">) {
  const { church } = await requireChurch();
  const sp = await searchParams;

  // Period — "YYYY" (whole year) or "YYYY-MM" (single month), defaulting to the current year.
  // One combo box drives the whole page: the summary cards, the member list and the print report.
  const currentYear = String(new Date().getFullYear());
  const period = parsePeriodParam(sp.month, currentYear);
  const isYear = period.length === 4;

  // Member search — narrows the rows shown; summary cards and the roster counts stay unfiltered.
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  // Year view has no single month — the toolbar's Record Tithe default falls back to the current month and
  // per-row "Record Tithe" buttons use the month of the section they sit in. "Print Tithers" follows the
  // same combo box and can be a month or a whole year.
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

  /** { id, name } list for the record / edit modals — one instance shared by every row. */
  const memberOptions = members.map((m) => ({ id: m.id, name: m.fullName }));

  const search = q.toLowerCase();
  const visibleMembers = search ? members.filter((m) => m.fullName.toLowerCase().includes(search)) : members;

  // Tithe rows for the selected period — the summary cards and the member list read the same set.
  const records = await titheRecordsFor(church.id, period);

  // This member's tithes per month section, keyed `month|memberId` — feeds the row's Edit button, which
  // opens one of them in the edit form (unique per member/week/month by database constraint).
  const tithesByRow = new Map<string, { id: string; week: number; month: string; amount: string }[]>();
  for (const r of records) {
    const key = `${r.month}|${r.memberId}`;
    const entry = { id: r.id, week: r.week, month: r.month, amount: String(r.amount) };
    const list = tithesByRow.get(key);
    if (list) list.push(entry);
    else tithesByRow.set(key, [entry]);
  }
  for (const list of tithesByRow.values()) list.sort((a, b) => a.week - b.week);

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

  /* Summary cards — card period only (the member search does not affect them) */
  let totalCollected = 0;
  const cardTithers = new Set<string>();

  for (const r of records) {
    cardTithers.add(r.memberId);
    totalCollected += Number(r.amount);
  }

  const monthLabel = isYear
    ? `Year ${period}`
    : new Date(period + "-01").toLocaleString("default", { month: "long", year: "numeric" });
  // Counted against the listed roster so "X of Y members" can never exceed the member count.
  const activeTithers = members.filter((m) => cardTithers.has(m.id)).length;

  /* Member list — list period only */
  const memberTithes = new Map<string, { [week: number]: number }>();
  const memberMonthTithes = new Map<string, Map<string, { [week: number]: number }>>();

  for (const r of records) {
    if (!memberTithes.has(r.memberId)) memberTithes.set(r.memberId, {});
    const map = memberTithes.get(r.memberId)!;
    const amt = Number(r.amount);
    // In year view, later months overwrite earlier ones per week — the Total column still sums everything correctly.
    // (Year view renders per-month groupings below instead of the weekly grid.)
    map[r.week] = (map[r.week] ?? 0) + amt;
    if (isYear) {
      if (!memberMonthTithes.has(r.memberId)) memberMonthTithes.set(r.memberId, new Map());
      const byMonth = memberMonthTithes.get(r.memberId)!;
      if (!byMonth.has(r.month)) byMonth.set(r.month, {});
      const mMap = byMonth.get(r.month)!;
      mMap[r.week] = (mMap[r.week] ?? 0) + amt;
    }
  }

  // Year view: months present in the data + per-month totals, newest first
  const yearMonths = isYear
    ? [...new Set(records.map((r) => r.month))].sort().reverse()
    : [];
  const yearMonthTotals = new Map<string, number>();
  for (const r of records) {
    yearMonthTotals.set(r.month, (yearMonthTotals.get(r.month) ?? 0) + Number(r.amount));
  }
  // While searching, only the months that have a matching tither are listed.
  const shownMonths = q
    ? yearMonths.filter((ym) => visibleMembers.some((m) => memberMonthTithes.get(m.id)?.get(ym)))
    : yearMonths;

  /* Member list sections — one per month and year the tithes were recorded for */
  /** Week amounts for one member inside one month section (year view keeps the months apart). */
  const memberWeeks = (month: string, memberId: string) =>
    isYear ? (memberMonthTithes.get(memberId)?.get(month) ?? {}) : (memberTithes.get(memberId) ?? {});
  const sumWeeks = (weeks: { [week: number]: number }) => Object.values(weeks).reduce((sum, amt) => sum + amt, 0);

  const listSections = (isYear ? shownMonths : [period]).map((month) => {
    const tithers = visibleMembers.filter((m) => sumWeeks(memberWeeks(month, m.id)) > 0);
    return {
      month,
      label: new Date(month + "-01").toLocaleString("default", { month: "long", year: "numeric" }),
      // Year view lists the members who tithed that month; the month view keeps the whole roster so the
      // members who have not given yet stay visible.
      rows: isYear ? tithers : visibleMembers,
      tithers: tithers.length,
      // While searching, the section total covers the rows shown so the two always agree.
      total:
        !q && isYear
          ? (yearMonthTotals.get(month) ?? 0)
          : visibleMembers.reduce((sum, m) => sum + sumWeeks(memberWeeks(month, m.id)), 0),
    };
  });

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
        {/* Actions — the period combo box sits with the list further down and drives the cards too */}
        <TithesToolbar month={toolbarMonth} period={period} members={memberOptions} />

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

        {/* Period selector + member search — the combo box filters the cards and the list together */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
          <TithePeriodDropdown currentPeriod={period} years={years} />
          <TitheSearch q={q} />
        </div>

        {/* Member list — a section per month and year the tithes were recorded for */}
        {members.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400 text-sm italic">
            No full members found.
          </div>
        ) : q && visibleMembers.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400 text-sm italic">
            No members match “{q}”.
          </div>
        ) : listSections.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400 text-sm italic">
            {q ? `No tithes recorded for “${q}” in ${period}.` : `No tithes recorded in ${period} yet.`}
          </div>
        ) : (
          <div className="space-y-4">
            {listSections.map(({ month, label, rows: sectionRows, tithers, total }) => {
              const weekCols = weekColumns(
                month,
                records.filter((r) => r.month === month).map((r) => r.week),
              );

              return (
                <div key={month} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
                  <div className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">{label}</p>
                    <p className="text-xs font-black text-emerald-600">
                      {cedis(total)} · {tithers} tither{tithers === 1 ? "" : "s"}
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 pl-8 h-14 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400 min-w-[200px]">
                          Member
                        </th>
                        {weekCols.map(({ week, label: sunday }) => (
                          <th
                            key={week}
                            className="px-4 h-14 text-center align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400"
                          >
                            Week {week}
                            {sunday && <span className="block text-[9px] font-bold opacity-70">{sunday}</span>}
                          </th>
                        ))}
                        <th className="px-4 h-14 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                          Total
                        </th>
                        <th className="px-4 pr-8 h-14 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionRows.map((m) => {
                        const weeks = memberWeeks(month, m.id);
                        const memberTotal = sumWeeks(weeks);

                        return (
                          <tr
                            key={m.id}
                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-4 pl-8 py-3.5">
                              <p className="font-bold text-slate-900">{m.fullName}</p>
                              <p className="text-[10px] font-bold uppercase text-slate-400">{m.category}</p>
                            </td>
                            {weekCols.map(({ week }) => (
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
                              {memberTotal > 0 ? cedis(memberTotal) : "—"}
                            </td>
                            <td className="px-4 pr-8 py-3.5 text-right">
                              <TitheActions
                                memberId={m.id}
                                memberName={m.fullName}
                                month={month}
                                members={memberOptions}
                                tithes={tithesByRow.get(`${month}|${m.id}`) ?? []}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
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
