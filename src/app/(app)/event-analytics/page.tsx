import Link from "next/link";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { ArrowLeft, ChartColumn, Calendar, TrendingUp, Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { PeriodSelect } from "./period-select";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Event Momentum" };

const { event, attendance, member } = schema;

const RANGES = {
  all: { label: "All Time", where: undefined },
  month: { label: "This Month", where: sql`${event.startsAt} >= date_trunc('month', current_date)` },
  quarter: { label: "Last 3 Months", where: sql`${event.startsAt} >= current_date - interval '3 months'` },
  year: { label: "This Year", where: sql`${event.startsAt} >= date_trunc('year', current_date)` },
} satisfies Record<string, { label: string; where: SQL | undefined }>;
type Range = keyof typeof RANGES;

export default async function EventMomentumPage({ searchParams }: PageProps<"/event-analytics">) {
  const { church } = await requireChurch();
  await requireModule("events");
  const sp = await searchParams;
  const range: Range = typeof sp.range === "string" && sp.range in RANGES ? (sp.range as Range) : "all";

  const [rows, [{ members }]] = await Promise.all([
    db
      .select({ id: event.id, title: event.title, type: event.type, startsAt: event.startsAt, checkins: count(attendance.id) })
      .from(event)
      .leftJoin(attendance, eq(attendance.eventId, event.id))
      .where(and(eq(event.churchId, church.id), sql`${event.startsAt} <= now()`, RANGES[range].where))
      .groupBy(event.id)
      .orderBy(desc(event.startsAt)),
    db
      .select({ members: count() })
      .from(member)
      .where(and(eq(member.churchId, church.id), eq(member.active, true))),
  ]);

  const checkins = rows.reduce((a, r) => a + r.checkins, 0);
  const avgPct = rows.length && members ? Math.round((checkins / rows.length / members) * 100) : 0;
  const label = RANGES[range].label;

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/events" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="h-3 w-3" /> Events
          </Link>
          <h1 className="flex items-center gap-2 text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            <TrendingUp className="h-8 w-8 text-emerald-500" /> Event Momentum
          </h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attendance analytics &amp; engagement tracking</p>
        </div>
        <PeriodSelect value={range} options={Object.entries(RANGES).map(([value, r]) => ({ value, label: r.label }))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card tone="from-emerald-500 to-emerald-600" icon={ChartColumn} label="Avg Attendance" value={`${avgPct}%`} />
        <Card tone="from-blue-500 to-blue-600" icon={Calendar} label="Events Tracked" value={String(rows.length)} />
        <Card tone="from-amber-500 to-orange-500" icon={Users} label="Total Check-ins" value={String(checkins)} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">{label} Breakdown</h2>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-[9px] font-black uppercase text-slate-400">
          {rows.length} Results
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">
          No past events in this period. Record attendance against events on the Attendance page.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const pct = members ? Math.round((r.checkins / members) * 100) : 0;
            return (
              <div key={r.id} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{r.title}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {r.type} · {new Date(r.startsAt.replace(" ", "T")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className="text-2xl font-black text-emerald-600">{pct}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  {r.checkins} of {members} active members checked in
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({ tone, icon: Icon, label, value }: { tone: string; icon: typeof Users; label: string; value: string }) {
  return (
    <div className={`flex items-center gap-4 rounded-[1.5rem] bg-gradient-to-br ${tone} p-6 text-white shadow-lg`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/90">{label}</p>
        <p className="text-3xl font-black">{value}</p>
      </div>
    </div>
  );
}
