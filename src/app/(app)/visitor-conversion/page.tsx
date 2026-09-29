import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { fmtDate } from "@/lib/utils";
import { ConvertButton } from "./convert-button";

export const metadata = { title: "Visitor Command Center" };

const { member, followUp } = schema;

export default async function VisitorConversionPage() {
  const { church } = await requireChurch();
  // A "tracked" visitor is anyone currently a Visitor or who was converted from one.
  const tracked = and(eq(member.churchId, church.id), sql`(${member.category} = 'Visitor' or ${member.convertedAt} is not null)`);

  const [[stats], active, funnelRows, cohorts] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        converted: sql<number>`count(${member.convertedAt})::int`,
        active: sql<number>`count(*) filter (where ${member.category} = 'Visitor' and ${member.active})::int`,
      })
      .from(member)
      .where(tracked),
    db
      .select({
        id: member.id,
        fullName: member.fullName,
        phone: member.phone,
        joinedAt: member.joinedAt,
        stage: followUp.stage,
      })
      .from(member)
      .leftJoin(followUp, and(eq(followUp.memberId, member.id), eq(followUp.kind, "convert")))
      .where(and(eq(member.churchId, church.id), eq(member.category, "Visitor"), eq(member.active, true)))
      .orderBy(asc(member.joinedAt)),
    db
      .select({ stage: followUp.stage, n: sql<number>`count(*)::int` })
      .from(followUp)
      .where(and(eq(followUp.churchId, church.id), eq(followUp.kind, "convert")))
      .groupBy(followUp.stage),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', coalesce(${member.joinedAt}, ${member.createdAt}::date)), 'YYYY-MM')`,
        visitors: sql<number>`count(*)::int`,
        converted: sql<number>`count(${member.convertedAt})::int`,
      })
      .from(member)
      .where(tracked)
      .groupBy(sql`1`)
      .orderBy(sql`1 desc`)
      .limit(12),
  ]);

  const rate = stats.total ? Math.round((stats.converted / stats.total) * 100) : 0;
  const reached = (stages: string[]) => funnelRows.filter((r) => stages.includes(r.stage)).reduce((a, r) => a + r.n, 0);
  const funnel = [
    { label: "First Visit", n: stats.total },
    { label: "Contacted", n: reached(["contacted", "visited", "integrated"]) },
    { label: "Home Visit", n: reached(["visited", "integrated"]) },
    { label: "Became Member", n: stats.converted },
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="px-1">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Visitor Command Center</h1>
        <p className="text-sm text-muted-foreground">Track analytics and directly manage your pipeline of potential members.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Tracked" value={stats.total} hint="All-time visitors" />
        <Stat label="Converted" value={stats.converted} hint="Became regular members" />
        <Stat label="Active Visitors" value={stats.active} hint="Currently in pipeline" />
        <Stat label="Conversion Rate" value={`${rate}%`} hint="Historical average" />
      </div>

      <section className="rounded-xl border bg-card shadow-card">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-black text-slate-900">Active Visitor Registry</h2>
          <p className="text-sm text-muted-foreground">Manage current visitors and convert them to official members.</p>
        </div>
        {active.length === 0 ? (
          <div className="px-6 pb-8 text-center">
            <p className="font-bold text-slate-700">No active visitors</p>
            <p className="text-sm text-muted-foreground">
              Use the Add Member button on the Members page and select &lsquo;Visitor&rsquo; as the category to add new prospects here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 px-2 pb-2">
            {active.map((v) => (
              <li key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-bold text-slate-900">{v.fullName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    First visit {v.joinedAt ? fmtDate(v.joinedAt) : "—"}
                    {v.phone ? ` · ${v.phone}` : ""} · Follow-up: {v.stage ?? "not started"}
                  </p>
                </div>
                <ConvertButton memberId={v.id} memberName={v.fullName} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-black text-slate-900">Conversion Funnel</h2>
          <p className="text-sm text-muted-foreground mb-4">Visitor journey from first visit to becoming a member</p>
          {stats.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No visitor funnel data available yet</p>
          ) : (
            <div className="space-y-3">
              {funnel.map((f) => (
                <div key={f.label}>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>{f.label}</span>
                    <span>{f.n}</span>
                  </div>
                  <div className="h-7 rounded-lg bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-lg bg-[#1e3a8a]" style={{ width: `${(f.n / stats.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-black text-slate-900">Monthly Cohort Analysis</h2>
          <p className="text-sm text-muted-foreground mb-4">Visitor conversions grouped by the month they first visited</p>
          {cohorts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No cohort data available. Add visitors to see analytics.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-2">Cohort</th>
                  <th className="py-2 text-right">Visitors</th>
                  <th className="py-2 text-right">Converted</th>
                  <th className="py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.month} className="border-t border-slate-100">
                    <td className="py-2 font-bold text-slate-700">
                      {new Date(c.month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2 text-right">{c.visitors}</td>
                    <td className="py-2 text-right">{c.converted}</td>
                    <td className="py-2 text-right font-black text-[#1e3a8a]">{Math.round((c.converted / c.visitors) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
