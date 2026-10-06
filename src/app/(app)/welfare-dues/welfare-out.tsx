import Link from "next/link";
import { and, countDistinct, desc, eq, sql } from "drizzle-orm";
import { Heart, Calendar, TrendingUp, Users } from "lucide-react";
import { db, schema } from "@/db";
import { inPeriod, sumAmount, type Period } from "@/lib/finance";
import { WELFARE_SUPPORT } from "@/lib/constants";
import { cedis, cn, fmtDate } from "@/lib/utils";
import { RecordWelfareButton } from "@/app/(app)/finances/finance-client";
import { DeleteButton } from "@/components/controls";
import { deleteTransaction } from "@/app/(app)/finances/actions";
import { PeriodSelector } from "./client";

const { transaction, member, welfareDues } = schema;

type Option = { id: string; fullName: string };

const MONTHS = [
  { num: "01", short: "Jan" },
  { num: "02", short: "Feb" },
  { num: "03", short: "Mar" },
  { num: "04", short: "Apr" },
  { num: "05", short: "May" },
  { num: "06", short: "Jun" },
  { num: "07", short: "Jul" },
  { num: "08", short: "Aug" },
  { num: "09", short: "Sep" },
  { num: "10", short: "Oct" },
  { num: "11", short: "Nov" },
  { num: "12", short: "Dec" },
];

export async function WelfareOutTab({
  churchId,
  period,
  members,
}: {
  churchId: string;
  period: Period;
  members: Option[];
}) {
  const isWelfare = eq(transaction.category, WELFARE_SUPPORT);
  const isYear = /^\d{4}$/.test(period);
  const selectedYear = period.slice(0, 4);
  const selectedMonthNum = !isYear ? period.slice(5, 7) : null;
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [
    [periodStats],
    [yearStats],
    [periodDues],
    yearMonthlyExpenses,
    yearMonthlyDues,
    rows,
  ] = await Promise.all([
    // 1. Stats for the selected period
    db
      .select({
        total: sumAmount,
        beneficiaries: countDistinct(transaction.memberId),
        count: sql<number>`count(*)`,
      })
      .from(transaction)
      .where(and(inPeriod(churchId, period), isWelfare)),

    // 2. Stats for the entire year
    db
      .select({
        total: sumAmount,
        beneficiaries: countDistinct(transaction.memberId),
        count: sql<number>`count(*)`,
      })
      .from(transaction)
      .where(and(inPeriod(churchId, selectedYear), isWelfare)),

    // 3. Dues collected in this period
    db
      .select({
        total: sql<string>`coalesce(sum(${welfareDues.amount}), 0)`,
      })
      .from(welfareDues)
      .where(
        and(
          eq(welfareDues.churchId, churchId),
          sql`cast(${welfareDues.date} as text) like ${period + "%"}`,
        ),
      ),

    // 4. Month-by-month expenses breakdown for selectedYear
    db
      .select({
        monthStr: sql<string>`to_char(${transaction.occurredOn}, 'YYYY-MM')`,
        total: sumAmount,
        count: sql<number>`count(*)`,
      })
      .from(transaction)
      .where(and(inPeriod(churchId, selectedYear), isWelfare))
      .groupBy(sql`to_char(${transaction.occurredOn}, 'YYYY-MM')`),

    // 5. Month-by-month dues breakdown for selectedYear
    db
      .select({
        monthStr: sql<string>`substring(cast(${welfareDues.date} as text) from 1 for 7)`,
        total: sql<string>`coalesce(sum(${welfareDues.amount}), 0)`,
      })
      .from(welfareDues)
      .where(
        and(
          eq(welfareDues.churchId, churchId),
          sql`cast(${welfareDues.date} as text) like ${selectedYear + "%"}`,
        ),
      )
      .groupBy(sql`substring(cast(${welfareDues.date} as text) from 1 for 7)`),

    // 6. Transaction rows for the selected period
    db
      .select({ t: transaction, memberName: member.fullName })
      .from(transaction)
      .leftJoin(member, eq(member.id, transaction.memberId))
      .where(and(inPeriod(churchId, period), isWelfare))
      .orderBy(desc(transaction.occurredOn), desc(transaction.createdAt))
      .limit(150),
  ]);

  const periodExp = Number(periodStats?.total ?? 0);
  const yearExp = Number(yearStats?.total ?? 0);
  const duesCol = Number(periodDues?.total ?? 0);
  const netBal = duesCol - periodExp;
  const beneficiaries = Number(periodStats?.beneficiaries ?? 0);

  // Map month expenses & dues
  const expenseMap = new Map<string, { total: number; count: number }>();
  for (const r of yearMonthlyExpenses) {
    expenseMap.set(r.monthStr, { total: Number(r.total), count: Number(r.count) });
  }

  const duesMap = new Map<string, number>();
  for (const r of yearMonthlyDues) {
    duesMap.set(r.monthStr, Number(r.total));
  }

  const activePeriodLabel = isYear
    ? `Year ${selectedYear}`
    : new Date(period + "-01").toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Period selector & Record Welfare Out Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PeriodSelector current={period} />
        <RecordWelfareButton members={members} />
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-3.5 w-3.5 text-pink-600" />
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              {isYear ? `Year ${selectedYear} Expenses` : "Month Expenses"}
            </p>
          </div>
          <p className="text-lg font-black text-pink-600 truncate">{cedis(periodExp)}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
            {isYear ? "All 12 months combined" : `For ${activePeriodLabel}`}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3.5 w-3.5 text-purple-600" />
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Year {selectedYear} Total
            </p>
          </div>
          <p className="text-lg font-black text-purple-600 truncate">{cedis(yearExp)}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
            Annual Welfare Out
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className={`h-3.5 w-3.5 ${netBal >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Net Balance
            </p>
          </div>
          <p className={`text-lg font-black truncate ${netBal >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {cedis(netBal)}
          </p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
            {cedis(duesCol)} in · {cedis(periodExp)} out
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-3.5 w-3.5 text-blue-600" />
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Beneficiaries
            </p>
          </div>
          <p className="text-lg font-black text-blue-600 truncate">{beneficiaries}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
            Members supported
          </p>
        </div>
      </div>

      {/* Monthly Expense Breakdown for Year */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-pink-600" />
              Monthly Expense Breakdown · {selectedYear}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Click any month to inspect its disbursements · Total Year: {cedis(yearExp)}
            </p>
          </div>
          {!isYear && (
            <Link
              href={`/welfare-dues?tab=disbursements&period=${selectedYear}`}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200 px-3 py-1.5 text-xs font-bold text-pink-700 transition-colors"
            >
              View Full Year ({selectedYear})
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
          {MONTHS.map((m) => {
            const ym = `${selectedYear}-${m.num}`;
            const mExp = expenseMap.get(ym)?.total ?? 0;
            const mCount = expenseMap.get(ym)?.count ?? 0;
            const mDues = duesMap.get(ym) ?? 0;
            const isSelected = !isYear && selectedMonthNum === m.num;
            const isCurrentMonth = ym === currentMonthStr;

            return (
              <Link
                key={m.num}
                href={`/welfare-dues?tab=disbursements&period=${ym}`}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all relative",
                  isSelected
                    ? "bg-pink-50/80 border-pink-500 ring-2 ring-pink-500/20 shadow-sm"
                    : mExp > 0
                    ? "bg-pink-50/20 border-pink-100 hover:border-pink-300 hover:shadow-sm"
                    : "bg-slate-50/40 border-slate-100 hover:bg-white hover:border-slate-200",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-800">{m.short}</span>
                  {isSelected && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-pink-600 bg-pink-100 px-1 rounded">
                      Active
                    </span>
                  )}
                  {!isSelected && isCurrentMonth && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-1 rounded">
                      Now
                    </span>
                  )}
                </div>
                <p className={cn("text-xs font-black mt-1", mExp > 0 ? "text-pink-600" : "text-slate-400")}>
                  {cedis(mExp)}
                </p>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
                  {mCount > 0 ? `${mCount} out · ${cedis(mDues)} in` : `GH₵ 0 out`}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Disbursements Ledger Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Disbursements · {activePeriodLabel}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {rows.length} {rows.length === 1 ? "record" : "records"} found
            </p>
          </div>
          <span className="text-xs font-black text-pink-600">{cedis(periodExp)}</span>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Heart className="h-8 w-8 text-pink-200 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No welfare disbursements recorded</p>
            <p className="text-xs text-slate-400 mt-1">
              No member care expenses recorded for {activePeriodLabel}. Click &ldquo;Record Member Care&rdquo; to add one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/30 border-b border-slate-100">
                <tr>
                  <th className="px-4 pl-6 h-11 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                    Beneficiary
                  </th>
                  <th className="px-4 h-11 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                    Date
                  </th>
                  <th className="px-4 h-11 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                    Reason / Notes
                  </th>
                  <th className="px-4 h-11 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                    Amount
                  </th>
                  <th className="px-4 pr-6 h-11 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(({ t, memberName }) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 pl-6 py-3.5">
                      <p className="font-bold text-slate-900">{memberName ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {fmtDate(t.occurredOn)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                      {t.description || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-pink-600 whitespace-nowrap">
                      {cedis(t.amount)}
                    </td>
                    <td className="px-4 pr-6 py-3.5 text-right">
                      <DeleteButton action={deleteTransaction.bind(null, t.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
