import { eq, and, gte, lt, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cedis, fmtDate } from "@/lib/utils";
import { weekColumns } from "@/lib/weeks";
import { PrintButton } from "../print-button";

export const metadata = { title: "Tithes Report" };

/** Visitors and regular attendees are still in the Akwaaba → SOB journey, so they are not members yet. */
const NON_MEMBER_CATEGORIES: string[] = ["Visitor", "Regular Attendee"];

export default async function TithesPrintPage({ searchParams }: PageProps<"/print/tithes">) {
  const { church } = await requireChurch();
  const sp = await searchParams;

  // Period from the tracker's card combo box — "YYYY-MM" (one month) or "YYYY" (the whole year),
  // falling back to the current month when it is missing or invalid.
  const period =
    typeof sp.month === "string" && (/^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) || /^\d{4}$/.test(sp.month))
      ? sp.month
      : new Date().toISOString().slice(0, 7);
  const isYear = period.length === 4;
  const periodLabel = isYear
    ? `Year ${period}`
    : new Date(period + "-01").toLocaleString("default", { month: "long", year: "numeric" });

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

  // Fetch tithes for the period, joined to the payer so a non-member tithe is never counted
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
        // A year is a prefix range over the stored "YYYY-MM" month.
        isYear
          ? and(gte(schema.tithe.month, `${period}-01`), lt(schema.tithe.month, `${Number(period) + 1}-01`))
          : eq(schema.tithe.month, period),
      )
    );

  // Whole-period map (summary + the single-month table) and, in year view, one map per month.
  const memberTithes = new Map<string, { [week: number]: number }>();
  const monthTithes = new Map<string, Map<string, { [week: number]: number }>>();
  let totalCollected = 0;
  
  for (const r of titheRecords) {
    const amt = Number(r.amount);
    totalCollected += amt;

    const weeks = memberTithes.get(r.memberId) ?? {};
    weeks[r.week] = (weeks[r.week] ?? 0) + amt;
    memberTithes.set(r.memberId, weeks);

    if (isYear) {
      const byMonth = monthTithes.get(r.month) ?? new Map<string, { [week: number]: number }>();
      const mWeeks = byMonth.get(r.memberId) ?? {};
      mWeeks[r.week] = (mWeeks[r.week] ?? 0) + amt;
      byMonth.set(r.memberId, mWeeks);
      monthTithes.set(r.month, byMonth);
    }
  }

  const onlyTithers = sp.only === "tithers";
  // Counted against the member roster so it can never exceed the member count.
  const activeTithers = members.filter((m) => memberTithes.has(m.id)).length;

  /**
   * One entry per table — the single month, or (year view) one per month that has tithes, Jan → Dec.
   * `label` heads the year-view tables; the report title already carries the single month's name.
   */
  const sections = isYear
    ? [...monthTithes.keys()].sort().map((mth) => {
        const recs = titheRecords.filter((r) => r.month === mth);
        const map = monthTithes.get(mth)!;
        const monthTithers = members.filter((m) => map.has(m.id));
        return {
          key: mth,
          label: new Date(mth + "-01").toLocaleString("default", { month: "long", year: "numeric" }),
          weekCols: weekColumns(mth, recs.map((r) => r.week)),
          map,
          rows: onlyTithers ? monthTithers : members,
          tithers: monthTithers.length,
          total: recs.reduce((sum, r) => sum + Number(r.amount), 0),
        };
      })
    : [
        {
          key: period,
          label: null as string | null,
          weekCols: weekColumns(period, titheRecords.map((r) => r.week)),
          map: memberTithes,
          rows: onlyTithers ? members.filter((m) => memberTithes.has(m.id)) : members,
          tithers: activeTithers,
          total: totalCollected,
        },
      ];

  return (
    <div className="min-h-screen bg-white py-8 px-6 max-w-5xl mx-auto text-slate-900">
      <div className="flex items-start justify-between gap-4 border-b-2 border-[#1e3a8a] pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">{church.name}</h1>
          <p className="text-sm text-slate-500">Tithes Tracker Report · {periodLabel}</p>
          <p className="text-xs text-slate-400">Generated {fmtDate(new Date())}</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-4 my-6 max-w-md">
        <Box label="Total Collected" value={cedis(totalCollected)} tone="text-green-700" />
        <Box label="Active Tithers" value={`${activeTithers} members`} tone="text-[#1e3a8a]" />
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-8 text-center text-xs italic text-slate-400">
          No tithes recorded for {periodLabel}.
        </div>
      ) : (
        sections.map((s) => (
          <div key={s.key} className="mb-8">
            {s.label && (
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">{s.label}</p>
                <p className="text-xs font-black text-emerald-600">
                  {cedis(s.total)} · {s.tithers} tither{s.tithers === 1 ? "" : "s"}
                </p>
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-left text-slate-500">
                  <th className="py-2 pl-2">Member</th>
                  {s.weekCols.map(({ week, label: sunday }) => (
                    <th key={week} className="py-2 text-center">
                      Week {week}
                      {sunday && <span className="block text-[9px] font-normal text-slate-400">{sunday}</span>}
                    </th>
                  ))}
                  <th className="py-2 pr-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.length === 0 ? (
                  <tr>
                    <td colSpan={s.weekCols.length + 2} className="py-8 text-center text-slate-400 italic">
                      No tithes recorded.
                    </td>
                  </tr>
                ) : (
                  s.rows.map((m) => {
                    const weeks = s.map.get(m.id) ?? {};
                    const total = s.weekCols.reduce((sum, w) => sum + (weeks[w.week] || 0), 0);

                    return (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-1.5 pl-2">
                          <p className="font-bold">{m.fullName}</p>
                          <p className="text-[9px] uppercase text-slate-400">{m.category}</p>
                        </td>
                        {s.weekCols.map(({ week }) => (
                          <td key={week} className="py-1.5 text-center">
                            {weeks[week] ? cedis(weeks[week]) : "—"}
                          </td>
                        ))}
                        <td className="py-1.5 pr-2 text-right font-bold text-slate-700">
                          {total > 0 ? cedis(total) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
