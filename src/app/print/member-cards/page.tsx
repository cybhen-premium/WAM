import { and, asc, eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { Church } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { PrintButton } from "../print-button";

export const metadata = { title: "Member QR Cards" };

/** Printable check-in cards. ?id=<member> prints one card, otherwise all active members. */
export default async function MemberCardsPage({ searchParams }: PageProps<"/print/member-cards">) {
  const { church } = await requireChurch();
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";

  const members = await db
    .select({ id: schema.member.id, fullName: schema.member.fullName, category: schema.member.category })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        id ? eq(schema.member.id, id) : eq(schema.member.active, true),
        sql`${schema.member.category} not in ('Visitor', 'Regular Attendee')`,
      ),
    )
    .orderBy(asc(schema.member.fullName));

  const cards = await Promise.all(
    members.map(async (m) => ({ ...m, qr: await QRCode.toDataURL(`ES:${m.id}`, { margin: 1, width: 240 }) })),
  );

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <p className="text-sm text-slate-600">
            {cards.length} card{cards.length === 1 ? "" : "s"}. Members show this code at the Attendance Gate.
          </p>
          <PrintButton />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:gap-2">
          {cards.map((c) => (
            <div key={c.id} className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white text-center">
              <div className="flex items-center justify-center gap-1.5 bg-[#1e3a8a] px-3 py-2 text-white">
                <Church className="h-3.5 w-3.5" />
                <span className="truncate text-[10px] font-black uppercase tracking-tight">{church.name}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
              <img src={c.qr} alt={`QR code for ${c.fullName}`} className="mx-auto mt-3 h-32 w-32" />
              <p className="mt-2 px-2 text-sm font-black text-slate-900 truncate">{c.fullName}</p>
              <p className="mb-3 text-[9px] font-bold uppercase tracking-widest text-slate-400">{c.category}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
