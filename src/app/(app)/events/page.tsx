import Link from "next/link";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, TrendingUp } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { NewEventButton, DeleteEventButton } from "./events-client";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Events" };

const { event } = schema;

const TYPE_STYLES: Record<string, string> = {
  Service: "bg-blue-50 text-blue-700",
  Rehearsal: "bg-purple-50 text-purple-700",
  Meeting: "bg-slate-100 text-slate-700",
  Outreach: "bg-green-50 text-green-700",
  Celebration: "bg-amber-50 text-amber-700",
  Other: "bg-pink-50 text-pink-700",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const { church } = await requireChurch();
  await requireModule("events");
  const sp = await searchParams;
  const todayIso = iso(new Date());
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : todayIso;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : day.slice(0, 7);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const gridStart = new Date(y, m - 1, 1 - first.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);

  const [monthEvents, dayEvents] = await Promise.all([
    db
      .select({ day: sql<string>`to_char(${event.startsAt}, 'YYYY-MM-DD')` })
      .from(event)
      .where(and(eq(event.churchId, church.id), gte(event.startsAt, iso(gridStart)), lt(event.startsAt, iso(gridEnd)))),
    db
      .select()
      .from(event)
      .where(and(eq(event.churchId, church.id), sql`${event.startsAt}::date = ${day}::date`))
      .orderBy(asc(event.startsAt)),
  ]);
  const busy = new Set(monthEvents.map((e) => e.day));

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  // Drop a trailing week that falls entirely in the next month.
  const weeks = cells.slice(35).every((d) => d.getMonth() !== m - 1) ? cells.slice(0, 35) : cells;

  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    return `/events?month=${iso(d).slice(0, 7)}&day=${day}`;
  };
  const dayLabel = new Date(day + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = (ts: string) => ts.slice(11, 16);

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Events</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schedule services and activities</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/event-analytics"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-emerald-200 bg-emerald-50/40 text-emerald-700 text-xs font-bold hover:bg-emerald-50"
          >
            <TrendingUp className="h-4 w-4" /> View Momentum
          </Link>
          <NewEventButton defaultDate={day} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/50 self-start">
          <div className="flex items-center justify-between mb-4">
            <Link href={shift(-1)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <p className="text-sm font-bold text-slate-800">
              {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <Link href={shift(1)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d} className="text-[11px] font-semibold text-slate-400 pb-2">
                {d}
              </span>
            ))}
            {weeks.map((d) => {
              const key = iso(d);
              const outside = d.getMonth() !== m - 1;
              const selected = key === day;
              return (
                <Link
                  key={key}
                  href={`/events?month=${month}&day=${key}`}
                  scroll={false}
                  className={cn(
                    "relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                    selected
                      ? "bg-[#1e3a8a] text-white ring-2 ring-amber-400"
                      : outside
                        ? "text-slate-300 hover:bg-slate-50"
                        : "text-slate-700 hover:bg-slate-100",
                    key === todayIso && !selected && "text-[#1e3a8a] font-black",
                  )}
                >
                  {d.getDate()}
                  {busy.has(key) && (
                    <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", selected ? "bg-amber-400" : "bg-orange-500")} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 min-h-[500px] overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
            <Calendar className="h-5 w-5 text-[#1e3a8a]" />
            <h2 className="text-lg font-black text-slate-900">{dayLabel}</h2>
          </div>
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 mb-3">
                <Calendar className="h-7 w-7 opacity-40" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">No scheduled activities</p>
            </div>
          ) : (
            <ul className="p-4 space-y-3">
              {dayEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-4 rounded-2xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-2">
                    <span className="text-sm font-black text-[#1e3a8a]">{time(e.startsAt)}</span>
                    {e.endsAt && <span className="text-[10px] font-bold text-slate-400">{time(e.endsAt)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900">{e.title}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase", TYPE_STYLES[e.type] ?? TYPE_STYLES.Other)}>
                        {e.type}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {e.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {e.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {time(e.startsAt)}
                        {e.endsAt ? ` – ${time(e.endsAt)}` : ""}
                      </span>
                    </div>
                    {e.description && <p className="mt-2 text-sm text-slate-600">{e.description}</p>}
                  </div>
                  <DeleteEventButton id={e.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
