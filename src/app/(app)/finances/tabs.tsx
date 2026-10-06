import Link from "next/link";
import { and, countDistinct, desc, eq, ilike, isNotNull, ne, notInArray, or, sql } from "drizzle-orm";
import { FileText, Printer } from "lucide-react";
import { db, schema } from "@/db";
import { inPeriod, receiptLabel, sumAmount, type Period } from "@/lib/finance";
import { TITHE, WELFARE_CATEGORIES, WELFARE_DUES, WELFARE_SUPPORT } from "@/lib/constants";
import { cedis, cn, fmtDate } from "@/lib/utils";
import {
  AddProjectButton,
  GivingTrendsChart,
  ReceiptTypeFilter,
  RecordContributionForm,
  RecordWelfareButton,
} from "./finance-client";
import { DeleteButton, SearchBox } from "@/components/controls";
import { deleteProject, deleteTransaction } from "./actions";

const { transaction, member, projectFund } = schema;

type Option = { id: string; fullName: string };

const TH = "px-4 h-12 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400";
const TD = "px-4 py-3 align-middle";

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-16 text-slate-400 text-xs font-bold uppercase tracking-widest">{children}</div>;
}

function Stat({ label, value, hint, tone = "text-slate-900" }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("text-2xl font-black mt-1 truncate", tone)}>{value}</p>
      {hint && <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

/* General ------------------------------------------------------------------ */

export async function GeneralTab({ churchId, period, q }: { churchId: string; period: Period; q: string }) {
  const like = `%${q}%`;
  const rows = await db
    .select({
      t: transaction,
      memberName: member.fullName,
    })
    .from(transaction)
    .leftJoin(member, eq(member.id, transaction.memberId))
    .where(and(inPeriod(churchId, period), notInArray(transaction.category, [...WELFARE_CATEGORIES]), q ? or(ilike(transaction.category, like), ilike(transaction.description, like)) : undefined))
    .orderBy(desc(transaction.occurredOn), desc(transaction.createdAt))
    .limit(200);

  return (
    <div>
      <div className="p-4 border-b border-slate-100 bg-slate-50/30">
        <SearchBox placeholder="Search by category or description..." initial={q} />
      </div>
      {rows.length === 0 ? (
        <Empty>No transactions recorded</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className={cn(TH, "pl-6")}>Date</th>
                <th className={TH}>Category</th>
                <th className={TH}>Details</th>
                <th className={cn(TH, "text-right")}>Amount</th>
                <th className={cn(TH, "pr-6 text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, memberName }) => (
                <tr key={t.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className={cn(TD, "pl-6 text-slate-500 text-xs font-semibold whitespace-nowrap")}>{fmtDate(t.occurredOn)}</td>
                  <td className={TD}>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase",
                        t.type === "income" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
                      )}
                    >
                      {t.category}
                    </span>
                  </td>
                  <td className={cn(TD, "text-slate-600")}>
                    {[memberName, t.description].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className={cn(TD, "text-right font-black", t.type === "income" ? "text-green-600" : "text-red-600")}>
                    {t.type === "expense" ? "−" : "+"}
                    {cedis(t.amount)}
                  </td>
                  <td className={cn(TD, "pr-6 text-right")}>
                    <div className="inline-flex gap-1">
                      {t.receiptNo && <PrintReceiptLink id={t.id} />}
                      <DeleteButton action={deleteTransaction.bind(null, t.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PrintReceiptLink({ id }: { id: string }) {
  return (
    <Link
      href={`/print/receipt/${id}`}
      target="_blank"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      title="Print receipt"
      aria-label="Print receipt"
    >
      <Printer className="h-4 w-4" />
    </Link>
  );
}

/* Tithes / Dues ------------------------------------------------------------ */

export async function ContributionTab({
  kind,
  churchId,
  period,
  members,
}: {
  kind: "tithes" | "dues";
  churchId: string;
  period: Period;
  members: Option[];
}) {
  const category = kind === "tithes" ? TITHE : WELFARE_DUES;
  const where = and(inPeriod(churchId, period), eq(transaction.category, category));

  const [[stats], rows] = await Promise.all([
    db
      .select({ contributors: countDistinct(transaction.memberId), total: sumAmount })
      .from(transaction)
      .where(where),
    db
      .select({ t: transaction, memberName: member.fullName })
      .from(transaction)
      .leftJoin(member, eq(member.id, transaction.memberId))
      .where(where)
      .orderBy(desc(transaction.occurredOn), desc(transaction.createdAt))
      .limit(200),
  ]);
  const contributors = stats.contributors;
  const nonContributors = Math.max(members.length - contributors, 0);
  const participation = members.length ? Math.round((contributors / members.length) * 100) : 0;
  const title = kind === "tithes" ? "Contribution Analytics" : "Welfare Dues Analytics";
  const noun = kind === "tithes" ? "Tithe" : "Welfare Dues";

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[1.5rem] bg-slate-50/60 border border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">{title}</h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cedis(stats.total)} total</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label={kind === "tithes" ? "Active Tithers" : "Active Contributors"} value={contributors} tone="text-green-600" />
            <Stat label="Non-Contributors" value={nonContributors} tone="text-orange-600" />
            <Stat label="Participation" value={`${participation}%`} tone="text-blue-700" />
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${participation}%` }} />
          </div>
        </div>
        <RecordContributionForm kind={kind} label={`Record ${noun}`} members={members} />
      </div>

      <div className="rounded-[1.5rem] border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50 border-b border-slate-100">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            History <span className="ml-2 text-slate-400">{rows.length} Logs</span>
          </p>
          <Link
            href={`/print/report?category=${encodeURIComponent(category)}${period !== "all" ? `&period=${period}` : ""}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-8 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </Link>
        </div>
        {rows.length === 0 ? (
          <Empty>No {kind === "tithes" ? "tithes" : "welfare dues"} recorded</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th className={cn(TH, "pl-5")}>Member</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Receipt #</th>
                  <th className={cn(TH, "text-right")}>Amount</th>
                  <th className={cn(TH, "pr-5 text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ t, memberName }) => (
                  <tr key={t.id} className="border-t border-slate-50">
                    <td className={cn(TD, "pl-5 font-bold text-slate-800")}>{memberName ?? "—"}</td>
                    <td className={cn(TD, "text-xs text-slate-500")}>{fmtDate(t.occurredOn)}</td>
                    <td className={cn(TD, "text-xs font-mono text-slate-500")}>{receiptLabel(t.receiptNo)}</td>
                    <td className={cn(TD, "text-right font-black text-green-600")}>{cedis(t.amount)}</td>
                    <td className={cn(TD, "pr-5 text-right")}>
                      <div className="inline-flex gap-1">
                        <PrintReceiptLink id={t.id} />
                        <DeleteButton action={deleteTransaction.bind(null, t.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* Analytics ---------------------------------------------------------------- */

export async function AnalyticsTab({ churchId }: { churchId: string }) {
  const mine = and(eq(transaction.churchId, churchId), notInArray(transaction.category, [...WELFARE_CATEGORIES]));

  const [months, projects] = await Promise.all([
    // Last 12 months including the current one, zero-filled.
    db.execute<{ month: string; income: string; expense: string }>(sql`
      select to_char(m, 'YYYY-MM') as month,
        coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as income,
        coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense
      from generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') m
      left join ${transaction} t
        on t.church_id = ${churchId} and t.category not in (${WELFARE_DUES}, ${WELFARE_SUPPORT}) and date_trunc('month', t.occurred_on) = m
      group by m order by m`),
    // Raised = total of the church's transactions tagged to each project. A left join (not a correlated
    // subquery) because drizzle renders a column inside `sql` unqualified — `... where project_id = "id"`
    // would bind to transaction.id and always sum to 0.
    db
      .select({ p: projectFund, raised: sumAmount })
      .from(projectFund)
      .leftJoin(
        transaction,
        and(eq(transaction.projectId, projectFund.id), eq(transaction.churchId, churchId)),
      )
      .where(eq(projectFund.churchId, churchId))
      .groupBy(projectFund.id)
      .orderBy(projectFund.createdAt),
  ]);

  const data = months.rows.map((r) => ({ month: r.month, income: Number(r.income), expense: Number(r.expense) }));
  const total12 = data.reduce((a, r) => a + r.income, 0);
  const thisMonth = data.at(-1)?.income ?? 0;
  const prevMonth = data.at(-2)?.income ?? 0;
  const change = prevMonth ? ((thisMonth - prevMonth) / prevMonth) * 100 : 0;
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="12-Month Total" value={cedis(total12)} tone="text-green-600" />
        <Stat label="Monthly Average" value={cedis(total12 / 12)} />
        <Stat
          label="This Month"
          value={cedis(thisMonth)}
          hint={`${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs prev`}
          tone="text-blue-700"
        />
      </div>

      <GivingTrendsChart data={data} />

      <div className="rounded-[1.5rem] border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Project Fund Progress</h3>
          <AddProjectButton />
        </div>
        {projects.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-500">
            No projects yet. Add one (e.g. Building Fund) and tag &ldquo;Project Fund&rdquo; income to it.
          </p>
        ) : (
          <div className="space-y-4">
            {projects.map(({ p, raised }) => {
              const pct = Math.min(100, (Number(raised) / Number(p.target)) * 100);
              return (
                <div key={p.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-900">{p.name}</p>
                      {p.dueOn && (
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Due: {fmtDate(p.dueOn)}</p>
                      )}
                    </div>
                    <DeleteButton action={deleteProject.bind(null, p.id)} />
                  </div>
                  <div className="flex justify-between text-xs font-bold mt-1">
                    <span className="text-slate-800">
                      {cedis(raised)} <span className="text-slate-400 font-semibold">of {cedis(p.target)}</span>
                    </span>
                    <span className="text-blue-700">{pct.toFixed(1)}% complete</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-[1.5rem] border border-slate-100 overflow-x-auto">
        <h3 className="px-5 pt-5 text-[11px] font-black uppercase tracking-widest text-slate-500">Monthly Breakdown</h3>
        <table className="w-full min-w-[480px] text-sm mt-2">
          <thead>
            <tr>
              <th className={cn(TH, "pl-5")}>Month</th>
              <th className={cn(TH, "text-right")}>Income</th>
              <th className={cn(TH, "text-right")}>Expenses</th>
              <th className={cn(TH, "pr-5 text-right")}>Net</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((r) => (
              <tr key={r.month} className="border-t border-slate-50">
                <td className={cn(TD, "pl-5 font-bold text-slate-700")}>
                  {new Date(r.month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </td>
                <td className={cn(TD, "text-right text-green-600 font-bold")}>{cedis(r.income)}</td>
                <td className={cn(TD, "text-right text-red-600 font-bold")}>{cedis(r.expense)}</td>
                <td className={cn(TD, "pr-5 text-right font-black", r.income - r.expense < 0 ? "text-red-600" : "text-slate-900")}>
                  {cedis(r.income - r.expense)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Receipts ----------------------------------------------------------------- */

export async function ReceiptsTab({ churchId, period, category }: { churchId: string; period: Period; category: string }) {
  const base = and(inPeriod(churchId, period), eq(transaction.type, "income"), isNotNull(transaction.receiptNo), notInArray(transaction.category, [...WELFARE_CATEGORIES]));
  const [rows, cats] = await Promise.all([
    db
      .select({ t: transaction, memberName: member.fullName })
      .from(transaction)
      .leftJoin(member, eq(member.id, transaction.memberId))
      .where(and(base, category ? eq(transaction.category, category) : undefined))
      .orderBy(desc(transaction.receiptNo))
      .limit(300),
    db.selectDistinct({ category: transaction.category }).from(transaction).where(base),
  ]);
  const total = rows.reduce((a, r) => a + Number(r.t.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <ReceiptTypeFilter categories={cats.map((c) => c.category)} value={category} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total Receipts" value={rows.length} />
        <Stat label="Total Amount" value={cedis(total)} tone="text-green-600" />
        <Stat label="Categories" value={`${cats.length} Active`} />
      </div>
      <div className="rounded-[1.5rem] border border-slate-100 overflow-x-auto">
        <h3 className="px-5 pt-5 text-[11px] font-black uppercase tracking-widest text-slate-500">Digital Receipts Log</h3>
        {rows.length === 0 ? (
          <Empty>No receipts found matching criteria</Empty>
        ) : (
          <table className="w-full min-w-[620px] text-sm mt-2">
            <thead>
              <tr>
                <th className={cn(TH, "pl-5")}>Receipt #</th>
                <th className={TH}>Date</th>
                <th className={TH}>Member</th>
                <th className={TH}>Category</th>
                <th className={cn(TH, "text-right")}>Amount</th>
                <th className={cn(TH, "pr-5 text-right")}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, memberName }) => (
                <tr key={t.id} className="border-t border-slate-50">
                  <td className={cn(TD, "pl-5 font-mono text-xs font-bold text-slate-700")}>{receiptLabel(t.receiptNo)}</td>
                  <td className={cn(TD, "text-xs text-slate-500")}>{fmtDate(t.occurredOn)}</td>
                  <td className={cn(TD, "text-slate-700")}>{memberName ?? "Anonymous"}</td>
                  <td className={cn(TD, "text-xs font-bold text-slate-500")}>{t.category}</td>
                  <td className={cn(TD, "text-right font-black text-green-600")}>{cedis(t.amount)}</td>
                  <td className={cn(TD, "pr-5 text-right")}>
                    <PrintReceiptLink id={t.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* Welfare Out -------------------------------------------------------------- */

export { WelfareOutTab } from "@/app/(app)/welfare-dues/welfare-out";

