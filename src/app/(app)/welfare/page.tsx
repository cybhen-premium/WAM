import Link from "next/link";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { DollarSign, Bot, Cake, Heart, ShieldCheck, TrendingDown, UserMinus } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { atRiskWhere, isThisMonth } from "@/lib/pastoral";
import { smsProviderConfigured } from "@/lib/sms";
import { cn, fmtDate } from "@/lib/utils";
import { AutomationForm, LostSheepActions, ReachOutAllButton } from "./welfare-client";
import { TablePagination } from "@/components/table-pagination";
import { MemberAvatar } from "@/components/member-avatar";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Member Care" };

const { member, followUp, staff } = schema;

const TABS = [
  { id: "overview", label: "Overview", icon: Heart },
  { id: "lost-sheep", label: "Lost Sheep", icon: UserMinus },
  { id: "automation", label: "Automation", icon: Bot },
] as const;

export default async function WelfarePage({ searchParams }: PageProps<"/welfare">) {
  const { church } = await requireChurch();
  await requireModule("welfare");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "overview";
  const page = Math.max(1, Number(sp?.page) || 1);
  const pageSize = Math.max(1, Number(sp?.pageSize) || 50);

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Member Care</h1>
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Privacy secured dashboard
        </p>
      </div>

      <nav className="grid w-full max-w-xl grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 sm:p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={id === "overview" ? "/welfare" : `/welfare?tab=${id}`}
            scroll={false}
            className={cn(
              "flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl h-9 sm:h-10 text-[11px] sm:text-xs font-bold transition-all",
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview church={church} />}
      {tab === "lost-sheep" && <LostSheep church={church} page={page} pageSize={pageSize} />}
      {tab === "automation" && (
        <AutomationForm
          enabled={church.automationEnabled}
          birthdayTemplate={church.birthdayTemplate}
          anniversaryTemplate={church.anniversaryTemplate}
          absenceTemplate={
            church.absenceTemplate ||
            "Hello [Name], we missed you at church today! We prayed for you and look forward to seeing you next Sunday. Have a blessed week!"
          }
          smsReady={await smsProviderConfigured()}
        />
      )}
    </div>
  );
}

type Church = Awaited<ReturnType<typeof requireChurch>>["church"];

async function Overview({ church }: { church: Church }) {
  const mine = eq(member.churchId, church.id);
  const pick = { id: member.id, fullName: member.fullName, photoUrl: member.photoUrl, phone: member.phone };
  const [atRisk, birthdays, anniversaries] = await Promise.all([
    db.select({ ...pick, date: member.lastAttendedAt }).from(member).where(atRiskWhere(church)).orderBy(asc(member.lastAttendedAt)),
    db
      .select({ ...pick, date: member.dateOfBirth })
      .from(member)
      .where(and(mine, eq(member.active, true), isThisMonth(member.dateOfBirth)))
      .orderBy(sql`extract(day from ${member.dateOfBirth})`),
    db
      .select({ ...pick, date: member.weddingAnniversary })
      .from(member)
      .where(and(mine, eq(member.active, true), isThisMonth(member.weddingAnniversary)))
      .orderBy(sql`extract(day from ${member.weddingAnniversary})`),
  ]);
  const day = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

  return (
    <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <OverviewCard label="At Risk" tone="text-red-600 bg-red-50" icon={TrendingDown} empty="No at risk this month" rows={atRisk.map((m) => ({ ...m, note: `Last seen ${day(m.date)}` }))} />
      <OverviewCard label="Birthdays" tone="text-amber-600 bg-amber-50" icon={Cake} empty="No birthdays this month" rows={birthdays.map((m) => ({ ...m, note: day(m.date) }))} />
      <OverviewCard label="Anniversaries" tone="text-pink-600 bg-pink-50" icon={Heart} empty="No anniversaries this month" rows={anniversaries.map((m) => ({ ...m, note: day(m.date) }))} className="sm:col-span-2 lg:col-span-1" />
    </div>
  );
}

function OverviewCard(props: {
  label: string;
  tone: string;
  icon: typeof Heart;
  empty: string;
  rows: { id: string; fullName: string; photoUrl?: string | null; note: string }[];
  className?: string;
}) {
  const Icon = props.icon;
  return (
    <div className={cn("rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/60 min-h-[240px]", props.className)}>
      <div className="flex items-start justify-between">
        <div>
          <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase", props.tone)}>{props.label}</span>
          <p className="mt-2 text-5xl font-black text-slate-900">{props.rows.length}</p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", props.tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {props.rows.length === 0 ? (
        <p className="mt-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">{props.empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {props.rows.slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <MemberAvatar name={r.fullName} photoUrl={r.photoUrl} size="xs" />
                <span className="font-bold text-slate-700 truncate">{r.fullName}</span>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{r.note}</span>
            </li>
          ))}
          {props.rows.length > 6 && <li className="text-xs text-slate-400">+{props.rows.length - 6} more</li>}
        </ul>
      )}
    </div>
  );
}

async function LostSheep({ church, page = 1, pageSize = 50 }: { church: Church; page?: number; pageSize?: number }) {
  const [sheep, [{ volunteers }], [{ pending }], visits] = await Promise.all([
    db
      .select({
        id: member.id,
        fullName: member.fullName,
        photoUrl: member.photoUrl,
        phone: member.phone,
        lastAttendedAt: member.lastAttendedAt,
        category: member.category,
        departmentName: schema.department.name,
      })
      .from(member)
      .leftJoin(schema.department, eq(member.departmentId, schema.department.id))
      .where(atRiskWhere(church))
      .orderBy(asc(member.lastAttendedAt)),
    db.select({ volunteers: count() }).from(staff).where(and(eq(staff.churchId, church.id), eq(staff.status, "active"))),
    db
      .select({ pending: count() })
      .from(followUp)
      .where(and(eq(followUp.churchId, church.id), eq(followUp.kind, "lost_sheep"), ne(followUp.stage, "integrated"))),
    db
      .select({ memberId: followUp.memberId })
      .from(followUp)
      .where(and(eq(followUp.churchId, church.id), eq(followUp.kind, "lost_sheep"), ne(followUp.stage, "integrated"))),
  ]);
  const scheduled = new Set(visits.map((v) => v.memberId));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Inactive Members"
          value={sheep.length}
          tone="text-red-600"
          subtitle={`Absent ${church.absenceThresholdWeeks}+ weeks`}
        />
        <Stat
          label="Available Volunteers"
          value={volunteers}
          tone="text-emerald-600"
          subtitle="Active staff & ministry workers"
        />
        <Stat
          label="Pending Visits"
          value={pending || "—"}
          tone="text-amber-600"
          subtitle="Scheduled pastoral visits"
        />
      </div>
      <div className="rounded-[2rem] bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900">Lost Sheep Registry</h2>
            <p className="text-xs text-slate-500">
              Flagged as Risk Members: Absent {church.absenceThresholdWeeks}+ weeks within a month or recorded absent 3+ times.
            </p>
          </div>
          {sheep.length > 0 && <ReachOutAllButton />}
        </div>
        {sheep.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-black text-slate-800">No Inactive Members</p>
            <p className="text-sm text-slate-500">All members are currently active. Great pastoral care!</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-50">
              {sheep.slice((page - 1) * pageSize, page * pageSize).map((m) => (
                <li key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4">
                  <div className="flex items-center gap-3.5">
                    <MemberAvatar name={m.fullName} photoUrl={m.photoUrl} size="md" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{m.fullName}</p>
                        {m.departmentName && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-[#1e3a8a]">
                            {m.departmentName}
                          </span>
                        )}
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase text-red-600">
                          Risk Member (Missed 3+ weeks)
                        </span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                        {m.category} · last seen {m.lastAttendedAt ? fmtDate(m.lastAttendedAt) : "never"}
                        {m.phone ? ` · ${m.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <LostSheepActions memberId={m.id} scheduled={scheduled.has(m.id)} hasPhone={!!m.phone} />
                </li>
              ))}
            </ul>
            <TablePagination
              currentPage={page}
              totalItems={sheep.length}
              pageSize={pageSize}
              useUrlParams={true}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, subtitle }: { label: string; value: React.ReactNode; tone: string; subtitle?: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("mt-1 text-3xl font-black", tone)}>{value}</p>
      {subtitle && <p className="mt-1 text-[11px] font-semibold text-slate-400">{subtitle}</p>}
    </div>
  );
}
