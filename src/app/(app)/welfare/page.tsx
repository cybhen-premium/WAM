import Link from "next/link";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { DollarSign, Bot, Cake, Heart, ShieldCheck, TrendingDown, UserMinus } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { atRiskWhere, isThisMonth } from "@/lib/pastoral";
import { smsProviderConfigured } from "@/lib/sms";
import { cn, fmtDate } from "@/lib/utils";
import { AutomationForm, LostSheepActions, ReachOutAllButton } from "./welfare-client";
import { WelfareOutTab } from "@/app/(app)/finances/tabs";
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
  await requireModule("care");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "overview";

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Member Care</h1>
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Privacy secured dashboard
        </p>
      </div>

      <nav className="grid w-full max-w-xl grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={id === "overview" ? "/welfare" : `/welfare?tab=${id}`}
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

      {tab === "overview" && <Overview church={church} />}
      {tab === "lost-sheep" && <LostSheep church={church} />}
      {tab === "automation" && (
        <AutomationForm
          enabled={church.automationEnabled}
          birthdayTemplate={church.birthdayTemplate}
          anniversaryTemplate={church.anniversaryTemplate}
          smsReady={await smsProviderConfigured()}
        />
      )}
    </div>
  );
}

type Church = Awaited<ReturnType<typeof requireChurch>>["church"];

async function Overview({ church }: { church: Church }) {
  const mine = eq(member.churchId, church.id);
  const pick = { id: member.id, fullName: member.fullName, phone: member.phone };
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
    <div className="grid gap-5 md:grid-cols-3">
      <OverviewCard label="At Risk" tone="text-red-600 bg-red-50" icon={TrendingDown} empty="No at risk this month" rows={atRisk.map((m) => ({ ...m, note: `Last seen ${day(m.date)}` }))} />
      <OverviewCard label="Birthdays" tone="text-amber-600 bg-amber-50" icon={Cake} empty="No birthdays this month" rows={birthdays.map((m) => ({ ...m, note: day(m.date) }))} />
      <OverviewCard label="Anniversaries" tone="text-pink-600 bg-pink-50" icon={Heart} empty="No anniversaries this month" rows={anniversaries.map((m) => ({ ...m, note: day(m.date) }))} />
    </div>
  );
}

function OverviewCard(props: {
  label: string;
  tone: string;
  icon: typeof Heart;
  empty: string;
  rows: { id: string; fullName: string; note: string }[];
}) {
  const Icon = props.icon;
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/60 min-h-[240px]">
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
        <ul className="mt-4 space-y-1.5">
          {props.rows.slice(0, 6).map((r) => (
            <li key={r.id} className="flex justify-between text-sm">
              <span className="font-bold text-slate-700 truncate">{r.fullName}</span>
              <span className="text-xs text-slate-400 shrink-0">{r.note}</span>
            </li>
          ))}
          {props.rows.length > 6 && <li className="text-xs text-slate-400">+{props.rows.length - 6} more</li>}
        </ul>
      )}
    </div>
  );
}

async function LostSheep({ church }: { church: Church }) {
  const [sheep, [{ volunteers }], [{ pending }], visits] = await Promise.all([
    db
      .select({ id: member.id, fullName: member.fullName, phone: member.phone, lastAttendedAt: member.lastAttendedAt, category: member.category })
      .from(member)
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
        <Stat label="Inactive Members" value={sheep.length} tone="text-red-600" />
        <Stat label="Available Volunteers" value={volunteers} tone="text-emerald-600" />
        <Stat label="Pending Visits" value={pending || "—"} tone="text-amber-600" />
      </div>
      <div className="rounded-[2rem] bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900">Lost Sheep Registry</h2>
            <p className="text-xs text-slate-500">Absent {church.absenceThresholdWeeks}+ weeks. Threshold is set in Settings → Preferences.</p>
          </div>
          {sheep.length > 0 && <ReachOutAllButton />}
        </div>
        {sheep.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-black text-slate-800">No Inactive Members</p>
            <p className="text-sm text-slate-500">All members are currently active. Great pastoral care!</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {sheep.map((m) => (
              <li key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="font-bold text-slate-900">{m.fullName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {m.category} · last seen {m.lastAttendedAt ? fmtDate(m.lastAttendedAt) : "never"}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </p>
                </div>
                <LostSheepActions memberId={m.id} scheduled={scheduled.has(m.id)} hasPhone={!!m.phone} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("mt-1 text-3xl font-black", tone)}>{value}</p>
    </div>
  );
}
