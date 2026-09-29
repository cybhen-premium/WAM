import { eq, and, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cedis, fmtDate } from "@/lib/utils";
import { PrintButton } from "../print-button";

export const metadata = { title: "Tithes Report" };

/** Visitors and regular attendees are still in the Akwaaba → SOB journey, so they are not members yet. */
const NON_MEMBER_CATEGORIES: string[] = ["Visitor", "Regular Attendee"];

export default async function TithesPrintPage({ searchParams }: PageProps<"/print/tithes">) {
  const { church } = await requireChurch();
  const sp = await searchParams;

  // Determine month — e.g. "2026-09"
  const month = typeof sp.month === "string" ? sp.month : new Date().toISOString().slice(0, 7);
  const monthLabel = new Date(month + "-01").toLocaleString("default", { month: "long", year: "numeric" });

  // Tithes are for members only — visitors / regular attendees are still in the Akwaaba → SOB journey.
  const members = await db
    .select({ id: schema.member.id, fullName: schema.member.fullName, category: schema.member.category })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.active, true),
        notInArray(schema.member.category, NON_MEMBER_CATEGORIES),
      )
    )
    .orderBy(schema.member.fullName);

  // Fetch tithes for this month, joined to the payer so a non-member tithe is never counted
  const titheRecords = await db
    .select({
      memberId: schema.tithe.memberId,
      amount: schema.tithe.amount,
      week: schema.tithe.week,
    })
    .from(schema.tithe)
    .innerJoin(schema.member, eq(schema.tithe.memberId, schema.member.id))
    .where(
      and(
        eq(schema.tithe.churchId, church.id),
        notInArray(schema.member.category, NON_MEMBER_CATEGORIES),
        eq(schema.tithe.month, month)
      )
    );

  const memberTithes = new Map<string, { [week: number]: number }>();
  let totalCollected = 0;
  
  for (const r of titheRecords) {
    if (!memberTithes.has(r.memberId)) memberTithes.set(r.memberId, {});
    const map = memberTithes.get(r.memberId)!;
    const amt = Number(r.amount);
    map[r.week] = amt;
    totalCollected += amt;
  }

  // Filter members to ONLY those who have tithed if requested
  const onlyTithers = sp.only === "tithers";
  const displayMembers = onlyTithers ? members.filter(m => memberTithes.has(m.id)) : members;
  // Counted against the member roster so it can never exceed the member count.
  const activeTithers = members.filter((m) => memberTithes.has(m.id)).length;

  return (
    <div className="min-h-screen bg-white py-8 px-6 max-w-5xl mx-auto text-slate-900">
      <div className="flex items-start justify-between gap-4 border-b-2 border-[#1e3a8a] pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">{church.name}</h1>
          <p className="text-sm text-slate-500">Tithes Tracker Report · {monthLabel}</p>
          <p className="text-xs text-slate-400">Generated {fmtDate(new Date())}</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-4 my-6 max-w-md">
        <Box label="Total Collected" value={cedis(totalCollected)} tone="text-green-700" />
        <Box label="Active Tithers" value={`${activeTithers} members`} tone="text-[#1e3a8a]" />
      </div>

      <table className="w-full text-xs mb-8">
        <thead>
          <tr className="border-b-2 border-slate-200 text-left text-slate-500">
            <th className="py-2 pl-2">Member</th>
            <th className="py-2 text-center">Week 1</th>
            <th className="py-2 text-center">Week 2</th>
            <th className="py-2 text-center">Week 3</th>
            <th className="py-2 text-center">Week 4</th>
            <th className="py-2 text-center">Week 5</th>
            <th className="py-2 pr-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {displayMembers.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                No tithes recorded.
              </td>
            </tr>
          ) : (
            displayMembers.map((m) => {
              const weeks = memberTithes.get(m.id) ?? {};
              const total = (weeks[1]||0) + (weeks[2]||0) + (weeks[3]||0) + (weeks[4]||0) + (weeks[5]||0);

              return (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-1.5 pl-2">
                    <p className="font-bold">{m.fullName}</p>
                    <p className="text-[9px] uppercase text-slate-400">{m.category}</p>
                  </td>
                  {[1, 2, 3, 4, 5].map(week => (
                    <td key={week} className="py-1.5 text-center">
                      {weeks[week] ? cedis(weeks[week]) : "—"}
                    </td>
                  ))}
                  <td className="py-1.5 pr-2 text-right font-bold text-slate-700">
                    {total > 0 ? cedis(total) : "—"}
                  </td>
                </tr>
              );
            })
          )}
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
