import Link from "next/link";
import { eq, sql, and, sum } from "drizzle-orm";
import { HandHeart, Heart, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { WelfareDuesToolbar, DuesActions, PeriodSelector, StatusBadge } from "./client";
import { WelfareOutTab } from "@/app/(app)/finances/tabs";

export const metadata = { title: "Welfare Dues" };

const MONTHLY_TARGET = 20;

const TABS = [
  { id: "contributions", label: "Contributions In", icon: HandHeart },
  { id: "disbursements", label: "Welfare Out", icon: Heart },
] as const;

export default async function WelfareDuesPage({ searchParams }: PageProps<"/welfare-dues">) {
  const { church } = await requireChurch();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "contributions";

  // Determine period — e.g. "2026-09" (month) or "2026" (year)
  const rawPeriod = typeof sp.period === "string" ? sp.period : new Date().toISOString().slice(0, 7);
  const isYear = /^\d{4}$/.test(rawPeriod);
  const periodFilter = rawPeriod + "%";

  const members = await db
    .select({ id: schema.member.id, fullName: schema.member.fullName, category: schema.member.category })
    .from(schema.member)
    .where(and(eq(schema.member.churchId, church.id), eq(schema.member.active, true)))
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

      <nav className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={id === "contributions" ? `/welfare-dues?period=${rawPeriod}` : `/welfare-dues?tab=${id}`}
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
        />
      )}
      {tab === "disbursements" && <WelfareOutTab churchId={church.id} period="all" members={members as any} />}
    </div>
  );
}

async function ContributionsTab({
  churchId,
  members,
  periodFilter,
  rawPeriod,
  isYear,
}: {
  churchId: string;
  members: { id: string; fullName: string; category: string }[];
  periodFilter: string;
  rawPeriod: string;
  isYear: boolean;
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

  const sumsMap = new Map(sums.map((s) => [s.memberId, Number(s.totalPaid)]));

  const totalCollected = sums.reduce((acc, r) => acc + Number(r.totalPaid), 0);

  // For year: 12 months × 20 GH₵ each
  // For month: 20 GH₵ each
  const memberCount = members.length;
  const expectedTotal = isYear ? memberCount * MONTHLY_TARGET * 12 : memberCount * MONTHLY_TARGET;
  const totalPaidCount = isYear
    ? members.filter((m) => (sumsMap.get(m.id) ?? 0) >= MONTHLY_TARGET * 12).length
    : members.filter((m) => (sumsMap.get(m.id) ?? 0) >= MONTHLY_TARGET).length;

  const paidMonths = isYear
    ? members.map((m) => {
        const paid = sumsMap.get(m.id) ?? 0;
        return Math.floor(paid / MONTHLY_TARGET);
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
        <WelfareDuesToolbar members={members.map((m) => ({ id: m.id, name: m.fullName }))} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Period"
          value={periodLabel}
          sub=""
          tone="text-slate-700"
          icon={TrendingUp}
        />
        <SummaryCard
          label="Total Collected"
          value={`GH₵ ${totalCollected.toFixed(2)}`}
          sub={`of GH₵ ${expectedTotal.toFixed(2)} expected`}
          tone="text-emerald-600"
          icon={HandHeart}
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
                const target = isYear ? MONTHLY_TARGET * 12 : MONTHLY_TARGET;
                const monthsPaid = isYear ? Math.min(12, Math.floor(paid / MONTHLY_TARGET)) : null;
                const progress = Math.min(100, Math.round((paid / target) * 100));

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
                      <DuesActions memberId={m.id} memberName={m.fullName} />
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
