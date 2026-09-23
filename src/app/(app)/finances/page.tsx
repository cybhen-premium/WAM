import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import {
  Building2,
  ChartPie,
  Heart,
  HandHeart,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { inPeriod, parsePeriod, periodLabel, periodOptions, sumAmount } from "@/lib/finance";
import { cedis, cn } from "@/lib/utils";
import { FinanceHeader } from "./finance-client";
import { AnalyticsTab, ContributionTab, GeneralTab, ReceiptsTab, VendorsTab, WelfareOutTab } from "./tabs";

export const metadata = { title: "Financial Hub" };

const TABS = [
  { id: "general", label: "General", icon: ChartPie },
  { id: "tithes", label: "Tithes", icon: Wallet },
  { id: "dues", label: "Welfare Dues", icon: HandHeart },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "vendors", label: "Vendors", icon: Building2 },
  { id: "receipts", label: "Receipts", icon: Receipt },
  { id: "welfare-out", label: "Welfare Out", icon: Heart },
] as const;
type TabId = (typeof TABS)[number]["id"];

const { transaction, member, vendor, projectFund } = schema;

export default async function FinancesPage({ searchParams }: PageProps<"/finances">) {
  const { church } = await requireChurch();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const tab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : "general";
  const q = typeof sp.q === "string" ? sp.q : "";

  const where = inPeriod(church.id, period);
  const [totals, breakdown, members, vendors, projects] = await Promise.all([
    db
      .select({ type: transaction.type, total: sumAmount })
      .from(transaction)
      .where(where)
      .groupBy(transaction.type),
    db
      .select({ category: transaction.category, type: transaction.type, total: sumAmount })
      .from(transaction)
      .where(where)
      .groupBy(transaction.category, transaction.type)
      .orderBy(sql`2, 3 desc`),
    db
      .select({ id: member.id, fullName: member.fullName })
      .from(member)
      .where(and(eq(member.churchId, church.id), eq(member.active, true)))
      .orderBy(member.fullName),
    db.select({ id: vendor.id, name: vendor.name }).from(vendor).where(eq(vendor.churchId, church.id)).orderBy(vendor.name),
    db
      .select({ id: projectFund.id, name: projectFund.name })
      .from(projectFund)
      .where(eq(projectFund.churchId, church.id))
      .orderBy(projectFund.createdAt),
  ]);
  const income = Number(totals.find((t) => t.type === "income")?.total ?? 0);
  const expenses = Number(totals.find((t) => t.type === "expense")?.total ?? 0);
  const net = income - expenses;

  const href = (t: TabId) => {
    const p = new URLSearchParams();
    if (period !== "all") p.set("period", period);
    if (t !== "general") p.set("tab", t);
    const s = p.toString();
    return s ? `/finances?${s}` : "/finances";
  };

  return (
    <div className="space-y-6 pb-24 px-2 sm:px-4 md:px-8">
      <FinanceHeader
        period={period}
        periods={periodOptions()}
        members={members}
        vendors={vendors}
        projects={projects}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Total Income" value={cedis(income)} border="border-l-green-500" text="text-green-600" />
        <SummaryCard label="Total Expenditure" value={cedis(expenses)} border="border-l-red-500" text="text-red-600" />
        <SummaryCard
          label="Net Balance"
          value={cedis(net)}
          border="border-l-blue-600"
          text={net < 0 ? "text-red-600" : "text-blue-700"}
          hint={period === "all" ? "All Time" : periodLabel(period)}
          className="bg-blue-50/50 sm:col-span-2 lg:col-span-1"
        />
      </div>

      <div className="bg-slate-50/50 rounded-[2rem] shadow-sm">
        <div className="p-5 pb-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <ChartPie className="h-4 w-4" /> Category Breakdown
          </h3>
        </div>
        <div className="p-5 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {breakdown.length === 0 ? (
              <div className="col-span-full text-center text-slate-400 py-6 text-xs font-bold uppercase tracking-widest">
                No transaction data available
              </div>
            ) : (
              breakdown.map((b) => (
                <div key={b.type + b.category} className="rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{b.category}</p>
                  <p className={cn("text-base font-black mt-0.5 truncate", b.type === "income" ? "text-green-600" : "text-red-600")}>
                    {b.type === "expense" ? "−" : ""}
                    {cedis(b.total)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="w-full overflow-x-auto border-b border-slate-100">
          <nav className="flex gap-1 p-2 w-max min-w-full">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                href={href(id)}
                scroll={false}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 font-bold text-xs transition-all",
                  tab === id ? "bg-slate-100 text-slate-900" : "text-muted-foreground hover:text-slate-700",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {tab === "general" && <GeneralTab churchId={church.id} period={period} q={q} />}
        {tab === "tithes" && <ContributionTab kind="tithes" churchId={church.id} period={period} members={members} />}
        {tab === "dues" && <ContributionTab kind="dues" churchId={church.id} period={period} members={members} />}
        {tab === "analytics" && <AnalyticsTab churchId={church.id} />}
        {tab === "vendors" && <VendorsTab churchId={church.id} />}
        {tab === "receipts" && (
          <ReceiptsTab churchId={church.id} period={period} category={typeof sp.category === "string" ? sp.category : ""} />
        )}
        {tab === "welfare-out" && <WelfareOutTab churchId={church.id} period={period} members={members} />}
      </div>
    </div>
  );
}

function SummaryCard(props: { label: string; value: string; border: string; text: string; hint?: string; className?: string }) {
  return (
    <div className={cn("bg-card border-l-4 shadow-md rounded-[1.5rem]", props.border, props.className)}>
      <div className="p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{props.label}</p>
        <p className={cn("text-3xl font-black mt-1 truncate", props.text)}>{props.value}</p>
        {props.hint && <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{props.hint}</p>}
      </div>
    </div>
  );
}
