import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Church } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cedis, fmtDate } from "@/lib/utils";
import { receiptLabel } from "@/lib/finance";
import { PrintButton } from "../../print-button";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: PageProps<"/print/receipt/[id]">) {
  const { church } = await requireChurch();
  await requireModule("finances");
  const { id } = await params;
  const [row] = await db
    .select({ t: schema.transaction, memberName: schema.member.fullName, memberPhone: schema.member.phone })
    .from(schema.transaction)
    .leftJoin(schema.member, eq(schema.member.id, schema.transaction.memberId))
    .where(and(eq(schema.transaction.id, id), eq(schema.transaction.churchId, church.id)))
    .limit(1);
  if (!row || row.t.type !== "income") notFound();
  const { t } = row;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-10 px-4">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex justify-end">
          <PrintButton />
        </div>
        <div className="rounded-3xl bg-white shadow-xl print:shadow-none overflow-hidden border border-slate-200">
          <div className="bg-[#1e3a8a] p-6 text-white text-center">
            <Church className="mx-auto h-8 w-8" />
            <h1 className="mt-2 text-xl font-black uppercase tracking-tight">{church.name}</h1>
            {church.location && <p className="text-xs text-blue-100">{church.location}</p>}
            {church.phone && <p className="text-xs text-blue-100">{church.phone}</p>}
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Official Receipt</p>
              <p className="font-mono text-sm font-bold">{receiptLabel(t.receiptNo)}</p>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Date" value={fmtDate(t.occurredOn)} />
              <Row label="Received From" value={row.memberName ?? "Anonymous"} />
              {row.memberPhone && <Row label="Phone" value={row.memberPhone} />}
              <Row label="Being Payment Of" value={t.category} />
              {t.description && <Row label="Notes" value={t.description} />}
            </dl>
            <div className="rounded-2xl bg-green-50 p-4 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-green-700">Amount</span>
              <span className="text-2xl font-black text-green-700">{cedis(t.amount)}</span>
            </div>
            <p className="text-center text-xs italic text-slate-500">
              &ldquo;God loves a cheerful giver.&rdquo; — 2 Corinthians 9:7
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-900 text-right">{value}</dd>
    </div>
  );
}
