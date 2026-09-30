import { and, count, eq, sql } from "drizzle-orm";
import { Activity, DollarSign, TrendingUp, Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { GrowthCharts } from "./growth-charts";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Growth Analytics" };

const { member, transaction } = schema;

const shortCedis = (n: number) => `₵${new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 }).format(n)}`;

export default async function GrowthPage() {
  const { church } = await requireChurch();
  await requireModule("analytics");

  const [[{ total }], months] = await Promise.all([
    db.select({ total: count() }).from(member).where(and(eq(member.churchId, church.id), sql`${member.category} not in ('Visitor', 'Regular Attendee')`)),
    // Last 6 months: new members, cumulative members, income and expenses.
    db.execute<{ month: string; joined: string; cumulative: string; income: string; expense: string }>(sql`
      with m as (
        select generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') as m
      )
      select to_char(m.m, 'YYYY-MM') as month,
        (select count(*) from ${member} x where x.church_id = ${church.id}
           and x.category not in ('Visitor', 'Regular Attendee')
           and date_trunc('month', coalesce(x.joined_at, x.created_at::date)) = m.m) as joined,
        (select count(*) from ${member} x where x.church_id = ${church.id}
           and x.category not in ('Visitor', 'Regular Attendee')
           and coalesce(x.joined_at, x.created_at::date) < m.m + interval '1 month') as cumulative,
        (select coalesce(sum(amount), 0) from ${transaction} t where t.church_id = ${church.id}
           and t.type = 'income' and date_trunc('month', t.occurred_on) = m.m) as income,
        (select coalesce(sum(amount), 0) from ${transaction} t where t.church_id = ${church.id}
           and t.type = 'expense' and date_trunc('month', t.occurred_on) = m.m) as expense
      from m order by m.m`),
  ]);

  const data = months.rows.map((r) => ({
    label: new Date(r.month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" }),
    joined: Number(r.joined),
    members: Number(r.cumulative),
    income: Number(r.income),
    expense: Number(r.expense),
  }));
  const cur = data.at(-1)!;
  const prev = data.at(-2)!;
  const revenue = data.reduce((a, r) => a + r.income, 0);
  const net = data.reduce((a, r) => a + r.income - r.expense, 0);
  const avgGrowth = data.reduce((a, r) => a + r.joined, 0) / data.length;
  const sign = (n: number) => (n >= 0 ? "+" : "−");

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="px-1">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Growth Analytics</h1>
        <p className="text-sm text-muted-foreground">Track your church&apos;s growth over time</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Total Members" value={String(total)} hint={`${sign(cur.joined)}${cur.joined} from last month`} />
        <Stat
          icon={DollarSign}
          label="Total Revenue"
          value={shortCedis(revenue)}
          hint={`${sign(cur.income - prev.income)}${shortCedis(Math.abs(cur.income - prev.income))} from last month`}
        />
        <Stat icon={TrendingUp} label="Avg Monthly Growth" value={avgGrowth.toFixed(avgGrowth % 1 ? 1 : 0)} hint="New members per month" />
        <Stat icon={Activity} label="Net Income" value={shortCedis(net)} hint="Last 6 months total" />
      </div>

      <GrowthCharts data={data} hasMembers={total > 0} hasMoney={data.some((d) => d.income || d.expense)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
