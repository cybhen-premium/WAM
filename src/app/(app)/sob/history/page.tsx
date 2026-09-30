import Link from "next/link";
import { eq, and, gte, lt } from "drizzle-orm";
import { ArrowLeft, Droplets } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { HistoryFilters, HistoryTable } from "./history-client";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Baptism History" };

/** Year the page falls back to when ?period is missing/invalid. */
function defaultYear(years: string[]): string {
  const thisYear = String(new Date().getFullYear());
  if (years.includes(thisYear)) return thisYear;
  return years[0] ?? thisYear;
}

/** "YYYY" | "YYYY-MM" — validated, defaults to the current year (or latest year with baptisms). */
function parseSelection(v: unknown, years: string[]): string {
  if (typeof v === "string") {
    if (/^\d{4}$/.test(v)) return v;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
  }
  return defaultYear(years);
}

export default async function SobHistoryPage({ searchParams }: PageProps<"/sob/history">) {
  const { church } = await requireChurch();
  await requireModule("sob");
  const sp = await searchParams;

  // Years with at least one baptism (year dropdown options)
  const yearRows = await db
    .select({ completedAt: schema.sobProgress.completedAt })
    .from(schema.sobProgress)
    .where(and(eq(schema.sobProgress.churchId, church.id), eq(schema.sobProgress.lesson, 4)))
    .limit(2000);
  const years = [...new Set(yearRows.map((r) => r.completedAt?.slice(0, 4)).filter((y): y is string => !!y))].sort().reverse();

  const selection = parseSelection(sp.period, years);

  // Baptisms in the selected period, oldest first
  const periodFilter =
    selection.length === 4
      ? and(
          gte(schema.sobProgress.completedAt, `${selection}-01-01`),
          lt(schema.sobProgress.completedAt, `${Number(selection) + 1}-01-01`),
        )
      : and(
          gte(schema.sobProgress.completedAt, `${selection}-01`),
          lt(
            schema.sobProgress.completedAt,
            new Date(Date.UTC(Number(selection.slice(0, 4)), Number(selection.slice(5, 7)), 1))
              .toISOString()
              .slice(0, 10),
          ),
        );

  const rows = await db
    .select({
      memberId: schema.sobProgress.memberId,
      completedAt: schema.sobProgress.completedAt,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      category: schema.member.category,
    })
    .from(schema.sobProgress)
    .innerJoin(schema.member, eq(schema.sobProgress.memberId, schema.member.id))
    .where(
      and(
        eq(schema.sobProgress.churchId, church.id),
        eq(schema.sobProgress.lesson, 4),
        periodFilter,
      ),
    )
    .orderBy(schema.sobProgress.completedAt)
    .limit(1000);

  const periodLabel =
    selection.length === 4
      ? selection
      : new Date(selection + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-200">
            <Droplets className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Baptism History</h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {rows.length} baptised · {periodLabel}
            </p>
          </div>
        </div>
        <Link
          href="/sob"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 h-11 md:h-9 text-[11px] font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" /> Back to SOB
        </Link>
      </div>

      <HistoryFilters years={years} selection={selection} />

      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        This log is kept for accountability — removing a row only hides it from this list. The record
        stays in the database and the person stays baptised.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
            <Droplets className="h-12 w-12 opacity-20" />
            <p className="font-bold text-sm">No baptisms found for this period.</p>
            <p className="text-xs">Try a different year or month.</p>
          </div>
        </div>
      ) : (
        <HistoryTable rows={rows} />
      )}
    </div>
  );
}
