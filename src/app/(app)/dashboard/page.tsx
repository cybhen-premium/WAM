import Link from "next/link";
import { and, count, eq, sql, type AnyColumn } from "drizzle-orm";
import {
  Cake,
  Calendar,
  ClipboardCheck,
  Clock,
  CreditCard,
  DollarSign,
  Heart,
  Sparkles,
  TriangleAlert,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { atRiskWhere } from "@/lib/pastoral";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Dashboard" };

const { member, staff } = schema;

export default async function DashboardPage() {
  const { church } = await requireChurch();
  await requireModule("dashboard");

  // Month/day of a date column compared against today, and against the next 7 days.
  const md = (col: AnyColumn) => sql`to_char(${col}, 'MM-DD')`;
  const today = sql`to_char(current_date, 'MM-DD')`;
  const inNextWeek = (col: AnyColumn) =>
    sql`${md(col)} in (select to_char(current_date + i, 'MM-DD') from generate_series(0, 6) as g(i))`;

  const [
    [{ total }],
    [{ upcoming }],
    birthdays,
    anniversaries,
    staffCounts,
    atRisk,
    genders,
    ageGroups,
  ] = await Promise.all([
    db.select({ total: count() }).from(member).where(and(eq(member.churchId, church.id), sql`${member.category} not in ('Visitor', 'Regular Attendee')`)),
    db
      .select({ upcoming: count() })
      .from(member)
      .where(and(eq(member.churchId, church.id), sql`(${inNextWeek(member.dateOfBirth)} or ${inNextWeek(member.weddingAnniversary)})`)),
    db
      .select({ id: member.id, fullName: member.fullName, phone: member.phone })
      .from(member)
      .where(and(eq(member.churchId, church.id), sql`${md(member.dateOfBirth)} = ${today}`)),
    db
      .select({ id: member.id, fullName: member.fullName, phone: member.phone })
      .from(member)
      .where(and(eq(member.churchId, church.id), sql`${md(member.weddingAnniversary)} = ${today}`)),
    db
      .select({ status: staff.status, n: count() })
      .from(staff)
      .where(eq(staff.churchId, church.id))
      .groupBy(staff.status),
    db
      .select({ id: member.id, fullName: member.fullName, lastAttendedAt: member.lastAttendedAt })
      .from(member)
      .where(atRiskWhere(church))
      .orderBy(member.lastAttendedAt)
      .limit(6),
    db
      .select({ gender: member.gender, n: count() })
      .from(member)
      .where(and(eq(member.churchId, church.id), sql`${member.category} not in ('Visitor', 'Regular Attendee')`))
      .groupBy(member.gender),
    db
      .select({
        bucket: sql<string>`case
          when ${member.dateOfBirth} is null then 'Unknown'
          when age(${member.dateOfBirth}) < interval '13 years' then 'Children'
          when age(${member.dateOfBirth}) < interval '20 years' then 'Teens'
          when age(${member.dateOfBirth}) < interval '36 years' then 'Young Adults'
          when age(${member.dateOfBirth}) < interval '60 years' then 'Adults'
          else 'Seniors' end`,
        n: count(),
      })
      .from(member)
      .where(and(eq(member.churchId, church.id), sql`${member.category} not in ('Visitor', 'Regular Attendee')`))
      .groupBy(sql`1`),
  ]);

  const activeStaff = staffCounts.find((s) => s.status === "active")?.n ?? 0;
  const pendingStaff = staffCounts.find((s) => s.status === "pending")?.n ?? 0;

  return (
    <div className="space-y-3 pb-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Dashboard</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard icon={Users} tone="bg-secondary text-secondary-foreground" label="Total Members" value={total} hint="In your congregation" />
          <StatCard icon={Cake} tone="bg-accent text-accent-foreground" label="Upcoming Celebrations" value={upcoming} hint="This week" />
        </div>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <QuickLink href="/members" icon={Users} label="Members" color="text-blue-600" />
        <QuickLink href="/finances" icon={DollarSign} label="Finances" color="text-emerald-600" />
        <QuickLink href="/events" icon={Calendar} label="Events" color="text-purple-600" />
        <QuickLink href="/attendance" icon={ClipboardCheck} label="Attendance" color="text-orange-600" />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-tight text-slate-500 px-1">Demographics Intelligence</h2>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-3">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold">No Demographic Data</p>
            <p className="text-xs mt-1">Add members to your database to unlock population insights.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <Breakdown
              title="Gender"
              total={total}
              rows={genders.map((g) => ({ label: g.gender ? cap(g.gender) : "Unspecified", n: g.n }))}
            />
            <Breakdown title="Age Groups" total={total} rows={ageGroups.map((a) => ({ label: a.bucket, n: a.n }))} />
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-3">
          <CelebrationCard
            title="Today's Birthdays"
            empty="No celebrations today"
            people={birthdays}
            border="border-amber-200"
            from="from-amber-50"
            text="text-amber-700"
            iconBg="bg-amber-100"
            badge="bg-amber-500"
            icon={<Cake className="h-4 w-4 text-amber-600 flex-shrink-0" />}
          />
          <CelebrationCard
            title="Today's Anniversaries"
            empty="No anniversaries today"
            people={anniversaries}
            border="border-pink-200"
            from="from-pink-50"
            text="text-pink-700"
            iconBg="bg-pink-100"
            badge="bg-pink-500"
            icon={<Heart className="h-4 w-4 fill-pink-500 text-pink-500 flex-shrink-0" />}
          />
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm animate-fade-in">
            <div className="p-6 pb-3">
              <h3 className="font-semibold tracking-tight flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Staff Overview
              </h3>
            </div>
            <div className="p-6 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                  <div className="p-2 rounded-full bg-success/20">
                    <UserCheck className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeStaff}</p>
                    <p className="text-xs text-muted-foreground">Active Staff</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="p-2 rounded-full bg-warning/20">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingStaff}</p>
                    <p className="text-xs text-muted-foreground">Pending Invites</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card text-card-foreground border-orange-200 bg-gradient-to-br from-orange-50/50 to-white shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
              <div className="space-y-1">
                <h3 className="font-semibold tracking-tight flex items-center gap-2 text-lg text-orange-700">
                  <TriangleAlert className="h-5 w-5 text-orange-500" />
                  <span className="font-black uppercase tracking-tight">At-Risk Members</span>
                </h3>
                <p className="text-[10px] font-bold text-orange-600/60 uppercase">Absent for {church.absenceThresholdWeeks}+ weeks</p>
              </div>
              <Link
                href="/message-center?audience=at-risk"
                className="inline-flex items-center justify-center text-sm border bg-background h-9 rounded-md px-3 border-orange-200 text-orange-700 hover:bg-orange-50 font-bold"
              >
                Reach Out All
              </Link>
            </div>
            <div className="p-6 pt-0 space-y-3">
              {atRisk.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-orange-100 rounded-2xl">
                  <p className="text-sm text-muted-foreground">All members are active!</p>
                </div>
              ) : (
                atRisk.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-white border border-orange-100 px-3 py-2">
                    <span className="text-sm font-bold text-slate-800">
                      {m.fullName}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-orange-600">Last seen {m.lastAttendedAt}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatCard(props: { icon: LucideIcon; tone: string; label: string; value: number | string; hint: string }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-card transition-all duration-300 hover:shadow-card-hover animate-slide-up">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${props.tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">{props.label}</p>
        <p className="text-2xl font-bold text-foreground">{props.value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{props.hint}</p>
      </div>
    </div>
  );
}

function QuickLink(props: { href: string; icon: LucideIcon; label: string; color: string; bg?: string }) {
  const Icon = props.icon;
  return (
    <Link href={props.href} className="group">
      <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-white p-2 shadow-sm transition-all hover:shadow-md text-center h-full">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${props.bg ?? "bg-slate-50"} group-hover:scale-110 transition-transform`}>
          <Icon className={`h-4 w-4 ${props.color}`} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-tight text-slate-600">{props.label}</span>
      </div>
    </Link>
  );
}

function Breakdown({ title, total, rows }: { title: string; total: number; rows: { label: string; n: number }[] }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{title}</p>
      <div className="space-y-2.5">
        {rows
          .sort((a, b) => b.n - a.n)
          .map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>{r.label}</span>
                <span>
                  {r.n} · {Math.round((r.n / total) * 100)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(r.n / total) * 100}%` }} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

type Person = { id: string; fullName: string; phone: string | null };

function CelebrationCard(props: {
  title: string;
  empty: string;
  people: Person[];
  border: string;
  from: string;
  text: string;
  iconBg: string;
  badge: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border bg-card ${props.border} bg-gradient-to-br ${props.from} to-white w-full shadow-sm overflow-hidden`}>
      <div className="p-6 pb-2">
        <h3 className={`font-semibold tracking-tight flex items-center gap-2 text-base sm:text-lg ${props.text}`}>
          <div className={`${props.iconBg} p-2 rounded-full`}>{props.icon}</div>
          <span className="font-black uppercase tracking-tight">{props.title}</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ml-2 ${props.badge}`}>
            {props.people.length}
          </span>
        </h3>
      </div>
      <div className="p-6 pt-0 space-y-3">
        {props.people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
            <Sparkles className="h-6 w-6 mb-2 opacity-20" />
            <p className="text-sm font-medium">{props.empty}</p>
          </div>
        ) : (
          props.people.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-white/80 border border-white px-3 py-2">
              <span className="text-sm font-bold text-slate-800">
                {p.fullName}
              </span>
              {p.phone && <span className="text-xs text-slate-500">{p.phone}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
