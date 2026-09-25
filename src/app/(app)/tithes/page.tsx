import Link from "next/link";
import { eq, sql, and, sum } from "drizzle-orm";
import { Wallet, TrendingUp, CheckCircle2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn, cedis } from "@/lib/utils";
import { TithesToolbar, MonthSelector, TitheActions } from "./client";

export const metadata = { title: "Tithes Tracker" };

export default async function TithesPage({ searchParams }: PageProps<"/tithes">) {
  const { church } = await requireChurch();
  const sp = await searchParams;

  // Determine month — e.g. "2026-09"
  const month = typeof sp.month === "string" ? sp.month : new Date().toISOString().slice(0, 7);

  const members = await db
    .select({ id: schema.member.id, fullName: schema.member.fullName, category: schema.member.category })
    .from(schema.member)
    .where(and(eq(schema.member.churchId, church.id), eq(schema.member.active, true)))
    .orderBy(schema.member.fullName);

  // Fetch tithes for this month
  const titheRecords = await db
    .select({
      memberId: schema.tithe.memberId,
      amount: schema.tithe.amount,
      week: schema.tithe.week,
    })
    .from(schema.tithe)
    .where(
      and(
        eq(schema.tithe.churchId, church.id),
        eq(schema.tithe.month, month)
      )
    );

  const memberTithes = new Map<string, { [week: number]: number }>();
  let totalCollected = 0;
  
  for (const r of titheRecords) {
    if (!memberTithes.has(r.memberId)) memberTithes.set(r.memberId, {});
    const map = memberTithes.get(r.memberId)!;
    const amt = Number(r.amount);
    map[r.week] = amt;
    totalCollected += amt;
  }

  const monthLabel = new Date(month + "-01").toLocaleString("default", { month: "long", year: "numeric" });
  const activeTithers = memberTithes.size;

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Tithes Tracker</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            Weekly tithe collection
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Period selector + toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <MonthSelector current={month} />
          <TithesToolbar month={month} members={members.map((m) => ({ id: m.id, name: m.fullName }))} />
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
            sub="Collected this month"
            tone="text-emerald-600"
            icon={Wallet}
          />
          <SummaryCard
            label="Active Tithers"
            value={`${activeTithers}`}
            sub={`of ${members.length} members`}
            tone="text-blue-600"
            icon={CheckCircle2}
          />
        </div>

        {/* Member table */}
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
              {members.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-40 text-center text-slate-400 text-sm italic">
                    No active members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
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
                        <TitheActions memberId={m.id} memberName={m.fullName} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
