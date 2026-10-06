import Link from "next/link";
import { eq, sql, and, desc, notInArray } from "drizzle-orm";
import { HandHeart, Heart, TrendingUp, Users, CheckCircle2, Wallet } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { WelfareDuesToolbar, DuesActions, PeriodSelector, StatusBadge, DuesTargetSection } from "./client";
import { WelfareOutTab } from "./welfare-out";
import { requireModule } from "@/lib/permissions";
import { inPeriod } from "@/lib/finance";
import { WELFARE_SUPPORT, WELFARE_MONTHLY_TARGET } from "@/lib/constants";

export const metadata = { title: "Welfare Dues" };

// Visitors and Regular Attendees are not full church members — exclude them from welfare dues
const NON_MEMBER_CATEGORIES = ["Visitor", "Regular Attendee"];

const TABS = [
  { id: "contributions", label: "Contributions In", icon: HandHeart },
  { id: "disbursements", label: "Welfare Out", icon: Heart },
] as const;

export default async function WelfareDuesPage({ searchParams }: PageProps<"/welfare-dues">) {
  const { church } = await requireChurch();
  await requireModule("care");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "contributions";

  const monthlyTarget = parseFloat(church.welfareMonthlyTarget ?? "20.00") || WELFARE_MONTHLY_TARGET;

  // Determine period — e.g. "2026-09" (month) or "2026" (All Months = the whole year)
  const rawPeriod = typeof sp.period === "string" ? sp.period : new Date().toISOString().slice(0, 7);
  const isYear = /^\d{4}$/.test(rawPeriod);
  const periodFilter = rawPeriod + "%";

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

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Welfare Dues</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            Manage member contributions and disbursements
          </p>
        </div>
      </div>

      <DuesTargetSection currentTarget={monthlyTarget} />

      <nav className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={id === "contributions" ? `/welfare-dues?period=${rawPeriod}` : `/welfare-dues?tab=${id}&period=${rawPeriod}`}
            scroll={false}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl h-10 text-xs font-bold transition-all",
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>

      {tab === "contributions" && (
        <ContributionsTab
          churchId={church.id}
          members={members}
          periodFilter={periodFilter}
          rawPeriod={rawPeriod}
          isYear={isYear}
          monthlyTarget={monthlyTarget}
        />
      )}
      {/* Welfare Out follows the same year/month selection as Contributions In. */}
      {tab === "disbursements" && <WelfareOutTab churchId={church.id} period={rawPeriod} members={members as any} />}
    </div>
  );
}

async function ContributionsTab({
  churchId,
  members,
  periodFilter,
  rawPeriod,
  isYear,
  monthlyTarget,
}: {
  churchId: string;
  members: { id: string; fullName: string; category: string }[];
  periodFilter: string;
  rawPeriod: string;
  isYear: boolean;
  monthlyTarget: number;
}) {
  // Sum dues per member for the selected period
  const sums = await db
    .select({
      memberId: schema.welfareDues.memberId,
      totalPaid: sql<number>`COALESCE(SUM(${schema.welfareDues.amount}), 0)`,
    })
    .from(schema.welfareDues)
    .where(
      and(
        eq(schema.welfareDues.churchId, churchId),
        sql`CAST(${schema.welfareDues.date} AS TEXT) LIKE ${periodFilter}`,
      ),
    )
    .groupBy(schema.welfareDues.memberId);

  // Fetch all individual dues records for the period (for edit/delete)
  const duesRecords = await db
    .select({
      id: schema.welfareDues.id,
      memberId: schema.welfareDues.memberId,
      amount: schema.welfareDues.amount,
      date: schema.welfareDues.date,
    })
    .from(schema.welfareDues)
    .where(
      and(
        eq(schema.welfareDues.churchId, churchId),
        sql`CAST(${schema.welfareDues.date} AS TEXT) LIKE ${periodFilter}`,
      ),
    )
    .orderBy(desc(schema.welfareDues.date));

  // Group dues records by memberId
  const duesMap = new Map<string, { id: string; amount: string; date: string }[]>();
  for (const d of duesRecords) {
    const existing = duesMap.get(d.memberId) ?? [];
    existing.push({ id: d.id, amount: d.amount, date: d.date });
    duesMap.set(d.memberId, existing);
  }

  const sumsMap = new Map(sums.map((s) => [s.memberId, Number(s.totalPaid)]));

  const totalCollected = sums.reduce((acc, r) => acc + Number(r.totalPaid), 0);

  const selectedYear = rawPeriod.slice(0, 4);

  // Welfare Out disbursements for selected period
  const [periodDisbursedRow] = await db
    .select({ total: sql<string>`coalesce(sum(${schema.transaction.amount}), 0)` })
    .from(schema.transaction)
    .where(
      and(
        eq(schema.transaction.churchId, churchId),
        eq(schema.transaction.category, WELFARE_SUPPORT),
        inPeriod(churchId, rawPeriod),
      ),
    );
  const totalDisbursed = Number(periodDisbursedRow?.total ?? 0);

  // Welfare Out disbursements for the entire year
  const [yearDisbursedRow] = await db
    .select({ total: sql<string>`coalesce(sum(${schema.transaction.amount}), 0)` })
    .from(schema.transaction)
    .where(
      and(
        eq(schema.transaction.churchId, churchId),
        eq(schema.transaction.category, WELFARE_SUPPORT),
        inPeriod(churchId, selectedYear),
      ),
    );
  const yearlyDisbursed = Number(yearDisbursedRow?.total ?? 0);

  const netBalance = totalCollected - totalDisbursed;

  // For year: 12 months × monthlyTarget GH₵ each
  // For month: monthlyTarget GH₵ each
  const memberCount = members.length;
  const expectedTotal = isYear ? memberCount * monthlyTarget * 12 : memberCount * monthlyTarget;
  const totalPaidCount = isYear
    ? members.filter((m) => (sumsMap.get(m.id) ?? 0) >= monthlyTarget * 12).length
    : members.filter((m) => (sumsMap.get(m.id) ?? 0) >= monthlyTarget).length;

  const paidMonths = isYear
    ? members.map((m) => {
        const paid = sumsMap.get(m.id) ?? 0;
        return Math.floor(paid / monthlyTarget);
      })
    : [];

  const periodLabel = isYear
    ? `Year ${rawPeriod}`
    : new Date(rawPeriod + "-01").toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Period selector + toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PeriodSelector current={rawPeriod} />
        <WelfareDuesToolbar
          members={members.map((m) => ({ id: m.id, name: m.fullName }))}
          target={monthlyTarget}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Net Balance"
          value={`GH₵ ${netBalance.toFixed(2)}`}
          sub={`GH₵ ${totalCollected.toFixed(2)} in · GH₵ ${totalDisbursed.toFixed(2)} out`}
          tone={netBalance >= 0 ? "text-emerald-700" : "text-rose-600"}
          icon={Wallet}
        />
        <SummaryCard
          label="Total Collected"
          value={`GH₵ ${totalCollected.toFixed(2)}`}
          sub={`of GH₵ ${expectedTotal.toFixed(2)} expected`}
          tone="text-emerald-600"
          icon={HandHeart}
        />
        <SummaryCard
          label="Total Expenses"
          value={`GH₵ ${totalDisbursed.toFixed(2)}`}
          sub={isYear ? `Year ${selectedYear} total` : `Year total: GH₵ ${yearlyDisbursed.toFixed(2)}`}
          tone="text-pink-600"
          icon={Heart}
          href={`/welfare-dues?tab=disbursements&period=${rawPeriod}`}
        />
        <SummaryCard
          label="Fully Paid"
          value={`${totalPaidCount}`}
          sub={`of ${memberCount} members`}
          tone="text-blue-600"
          icon={CheckCircle2}
        />
        <SummaryCard
          label="In Arrears"
          value={`${memberCount - totalPaidCount}`}
          sub="members behind"
          tone="text-red-500"
          icon={Users}
        />
      </div>

      {/* Member table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-4 pl-8 h-14 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Member
              </th>
              <th className="px-4 h-14 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {isYear ? "Progress (Months)" : "Progress"}
              </th>
              <th className="px-4 h-14 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Status
              </th>
              <th className="px-4 pr-8 h-14 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="h-40 text-center text-slate-400 text-sm italic">
                  No active members found.
                </td>
              </tr>
            ) : (
              members.map((m) => {
                const paid = sumsMap.get(m.id) ?? 0;
                const target = isYear ? monthlyTarget * 12 : monthlyTarget;
                const monthsPaid = isYear ? Math.min(12, Math.floor(paid / monthlyTarget)) : null;
                const progress = Math.min(100, Math.round((paid / target) * 100));
                const memberDues = duesMap.get(m.id) ?? [];
                const isPaid = paid >= target;

                return (
                  <tr
                    key={m.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 pl-8 py-3.5">
                      <p className="font-bold text-slate-900">{m.fullName}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">{m.category}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${paid >= target ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-slate-500">
                            GH₵ {paid.toFixed(2)} / {target}
                          </span>
                        </div>
                        {isYear && monthsPaid !== null && (
                          <div className="flex gap-0.5 mt-1">
                            {Array.from({ length: 12 }, (_, i) => (
                              <div
                                key={i}
                                className={`h-2 w-2 rounded-sm ${i < monthsPaid ? "bg-emerald-400" : "bg-slate-200"}`}
                                title={`Month ${i + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge paid={paid} target={target} />
                    </td>
                    <td className="px-4 pr-8 py-3.5 text-right">
                      <DuesActions
                        memberId={m.id}
                        memberName={m.fullName}
                        isPaid={isPaid}
                        dues={memberDues}
                        target={monthlyTarget}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
  href,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
  icon: typeof TrendingUp;
  href?: string;
}) {
  const content = (
    <div className={cn("rounded-2xl bg-white border border-slate-100 shadow-sm p-4 transition-all h-full", href && "hover:border-pink-200 hover:shadow-md cursor-pointer")}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${tone}`} />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        </div>
        {href && <span className="text-[9px] font-bold text-pink-500 hover:text-pink-600">Inspect →</span>}
      </div>
      <p className={`text-lg font-black ${tone} truncate`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">{sub}</p>}
    </div>
  );

  return href ? <Link href={href} className="block">{content}</Link> : content;
}
