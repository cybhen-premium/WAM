import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { fmtDate } from "@/lib/utils";
import { AkwaabaPrintControls } from "./controls";

export const metadata = { title: "Akwaaba Report" };

/** The two *current* reception statuses; anything else in the intake is someone who has graduated. */
const AKWAABA_CATEGORIES = ["Visitor", "Regular Attendee"];

const GROUPS = {
  visiting: { label: "Visitors", category: "Visitor" },
  staying: { label: "Staying", category: "Regular Attendee" },
} as const;

type GroupKey = keyof typeof GROUPS;
type SectionKey = GroupKey | "members";

export default async function AkwaabaPrintPage({ searchParams }: PageProps<"/print/akwaaba">) {
  const { church } = await requireChurch();
  const sp = await searchParams;

  // One month — "YYYY-MM", defaulting to the current month when missing or invalid.
  const month =
    typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month)
      ? sp.month
      : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  // "all" prints visitors and staying under their own headings; the other values print just that section.
  const group: GroupKey | "all" = sp.group === "visiting" || sp.group === "staying" ? sp.group : "all";

  // People received (registered) inside the month — joinedAt is the reception date the cards count on too.
  // Filtered on `fromAkwaaba`, so someone who was later baptised into a full member still appears.
  const people = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      gender: schema.member.gender,
      phone: schema.member.phone,
      email: schema.member.email,
      address: schema.member.address,
      invitedBy: schema.member.invitedBy,
      category: schema.member.category,
      joinedAt: schema.member.joinedAt,
    })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.fromAkwaaba, true),
        gte(schema.member.joinedAt, start),
        lt(schema.member.joinedAt, end),
        group === "all" ? undefined : eq(schema.member.category, GROUPS[group].category),
      ),
    )
    .orderBy(asc(schema.member.joinedAt), asc(schema.member.fullName));

  const monthLabel = new Date(month + "-01").toLocaleString("default", { month: "long", year: "numeric" });
  const sections = (
    group === "all" ? (["visiting", "staying", "members"] as SectionKey[]) : [group]
  ).map((key) => ({
    key,
    label: key === "members" ? "Now Members" : GROUPS[key].label,
    // "members" = everyone who has since graduated out of the two reception statuses.
    rows:
      key === "members"
        ? people.filter((p) => !AKWAABA_CATEGORIES.includes(p.category))
        : people.filter((p) => p.category === GROUPS[key].category),
  }));
  const visitingCount = people.filter((p) => p.category === "Visitor").length;
  const stayingCount = people.filter((p) => p.category === "Regular Attendee").length;
  const memberCount = people.length - visitingCount - stayingCount;


  return (
    <div className="min-h-screen bg-white py-8 px-6 max-w-5xl mx-auto text-slate-900">
      <AkwaabaPrintControls month={month} />

      <div className="flex items-start justify-between gap-4 border-b-2 border-[#1e3a8a] pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">{church.name}</h1>
          <p className="text-sm text-slate-500">Akwaaba Reception Report · {monthLabel}</p>
          <p className="text-xs text-slate-400">Generated {fmtDate(new Date())}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6 max-w-2xl">
        <Box label="Total Received" value={people.length} tone="text-[#1e3a8a]" />
        <Box label="Visitors" value={visitingCount} tone="text-blue-700" />
        <Box label="Staying" value={stayingCount} tone="text-emerald-700" />
        <Box label="Now Members" value={memberCount} tone="text-slate-700" />
      </div>

      {people.length === 0 ? (
        <p className="rounded-xl border border-slate-200 p-8 text-center text-xs italic text-slate-400">
          No one was received in {monthLabel}.
        </p>
      ) : (
        sections.map((section) => (
          <section key={section.key} className="mb-8">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-700">{section.label}</p>
              <p className="text-xs font-black text-slate-500">
                {section.rows.length} {section.rows.length === 1 ? "person" : "people"}
              </p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-left text-slate-500">
                  <th className="py-2 pl-2 w-8">#</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Gender</th>
                  <th className="py-2">Contact</th>
                  <th className="py-2">Location</th>
                  <th className="py-2">Invited By</th>
                  <th className="py-2 pr-2 text-right">Date Received</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((person, i) => (
                  <tr key={person.id} className="border-b border-slate-100">
                    <td className="py-1.5 pl-2 text-slate-400">{i + 1}</td>
                    <td className="py-1.5 font-bold">{person.fullName}</td>
                    <td className="py-1.5 capitalize text-slate-600">{person.gender ?? "—"}</td>
                    <td className="py-1.5 text-slate-600">
                      {[person.phone, person.email].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-1.5 text-slate-600">{person.address ?? "—"}</td>
                    <td className="py-1.5 text-slate-600">{person.invitedBy ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-600">
                      {person.joinedAt ? fmtDate(person.joinedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

