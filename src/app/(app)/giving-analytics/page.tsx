import { and, countDistinct, eq, sql } from "drizzle-orm";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { sumAmount } from "@/lib/finance";
import { cedis } from "@/lib/utils";
import { TrendChart } from "@/components/trend-chart";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Giving Analytics" };

const { transaction } = schema;

export default async function GivingAnalyticsPage() {
  const { church } = await requireChurch();
  await requireModule("analytics");
  const income = and(eq(transaction.churchId, church.id), eq(transaction.type, "income"));

  const [[totals], months] = await Promise.all([
    db
      .select({ total: sumAmount, donors: countDistinct(transaction.memberId) })
      .from(transaction)
      .where(income),
    db.execute<{ month: string; total: string }>(sql`
      select to_char(m, 'YYYY-MM') as month, coalesce(sum(t.amount), 0) as total
      from generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') m
      left join ${transaction} t
        on t.church_id = ${church.id} and t.type = 'income' and date_trunc('month', t.occurred_on) = m
      group by m order by m`),
  ]);

  const total = Number(totals.total);
  const avg = totals.donors ? total / totals.donors : 0;
  const data = months.rows.map((r) => ({
    label: new Date(r.month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" }),
    value: Number(r.total),
  }));

  return (
    <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="px-1">
        <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">Giving Analytics</h1>
        <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">Automated Financial Insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card label="Total Revenue" value={cedis(total)} icon={<DollarSign className="h-3.5 w-3.5 opacity-50" />} dark />
        <Card label="Avg / Contributor" value={cedis(avg)} icon={<TrendingUp className="h-3.5 w-3.5 text-primary opacity-30" />} />
        <Card label="Total Donors" value={String(totals.donors)} icon={<Users className="h-3.5 w-3.5 text-slate-400 opacity-30" />} />
      </div>

      <div className="rounded-[2rem] shadow-sm bg-white border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6">
          <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">6-Month Trend Analysis</h4>
          <div className="h-[250px] md:h-[350px] w-full">
            <TrendChart data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, icon, dark }: { label: string; value: string; icon: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={
        dark
          ? "rounded-[1.5rem] shadow-md bg-[#1e3a8a] text-white overflow-hidden"
          : "rounded-[1.5rem] border border-slate-100 shadow-sm bg-white overflow-hidden"
      }
    >
      <div className="p-4 flex flex-col justify-between h-full space-y-2">
        <div className="flex justify-between items-start">
          <p className={`text-[9px] font-black uppercase tracking-widest ${dark ? "opacity-80" : "text-slate-400"}`}>{label}</p>
          {icon}
        </div>
        <h3 className={`text-xl md:text-2xl font-black truncate leading-none ${dark ? "" : "text-slate-900"}`}>{value}</h3>
      </div>
    </div>
  );
}
