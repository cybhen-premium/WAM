import { and, desc, eq, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { inPeriod, parsePeriod, periodLabel, sumAmount } from "@/lib/finance";
import { WELFARE_CATEGORIES } from "@/lib/constants";
import { cedis, fmtDate } from "@/lib/utils";
import { PrintButton } from "../print-button";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Financial Report" };

const { transaction, member } = schema;

export default async function ReportPage({ searchParams }: PageProps<"/print/report">) {
  const { church } = await requireChurch();
  await requireModule("finances");
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const category = typeof sp.category === "string" ? sp.category : "";
  const where = and(inPeriod(church.id, period), category ? eq(transaction.category, category) : notInArray(transaction.category, [...WELFARE_CATEGORIES]));

  const [byCategory, rows] = await Promise.all([
    db
      .select({ category: transaction.category, type: transaction.type, total: sumAmount })
      .from(transaction)
      .where(where)
      .groupBy(transaction.category, transaction.type)
      .orderBy(transaction.type, transaction.category),
    db
      .select({ t: transaction, memberName: member.fullName })
      .from(transaction)
      .leftJoin(member, eq(member.id, transaction.memberId))
      .where(where)
      .orderBy(desc(transaction.occurredOn))
      .limit(1000),
  ]);
  const income = byCategory.filter((c) => c.type === "income").reduce((a, c) => a + Number(c.total), 0);
  const expense = byCategory.filter((c) => c.type === "expense").reduce((a, c) => a + Number(c.total), 0);

  return (
    <div className="min-h-screen bg-white py-8 px-6 max-w-4xl mx-auto text-slate-900">
      <div className="flex items-start justify-between gap-4 border-b-2 border-[#1e3a8a] pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">{church.name}</h1>
          <p className="text-sm text-slate-500">
            {category ? `${category} Report` : "Financial Report"} · {periodLabel(period)}
          </p>
          <p className="text-xs text-slate-400">Generated {fmtDate(new Date())}</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-3 gap-4 my-6">
        <Box label="Total Income" value={cedis(income)} tone="text-green-700" />
        <Box label="Total Expenses" value={cedis(expense)} tone="text-red-700" />
        <Box label="Net Balance" value={cedis(income - expense)} tone="text-[#1e3a8a]" />
      </div>

      <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">By Category</h2>
      <table className="w-full text-sm mb-8">
        <tbody>
          {byCategory.map((c) => (
            <tr key={c.type + c.category} className="border-b border-slate-100">
              <td className="py-1.5">{c.category}</td>
              <td className="py-1.5 text-slate-500 capitalize">{c.type}</td>
              <td className="py-1.5 text-right font-bold">{cedis(c.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Transactions ({rows.length})</h2>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-slate-200 text-left text-slate-500">
            <th className="py-1.5">Date</th>
            <th className="py-1.5">Category</th>
            <th className="py-1.5">Member / Details</th>
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, memberName }) => (
            <tr key={t.id} className="border-b border-slate-100">
              <td className="py-1.5 whitespace-nowrap">{fmtDate(t.occurredOn)}</td>
              <td className="py-1.5">{t.category}</td>
              <td className="py-1.5">{[memberName, t.description].filter(Boolean).join(" · ")}</td>
              <td className={`py-1.5 text-right font-bold ${t.type === "income" ? "text-green-700" : "text-red-700"}`}>
                {t.type === "expense" ? "−" : ""}
                {cedis(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
