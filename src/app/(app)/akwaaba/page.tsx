import { eq, and, ilike, asc, count } from "drizzle-orm";
import { HandHeart, Users, Briefcase, MapPin, Phone, UserCheck } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AkwaabaToolbar, AkwaabaFilters, PersonRowActions } from "./client";

export const metadata = { title: "Akwaaba - Reception" };

export default async function AkwaabaPage({ searchParams }: PageProps<"/akwaaba">) {
  const { church } = await requireChurch();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";

  // Fetch people with filters
  const filters: any[] = [eq(schema.member.churchId, church.id)];
  if (status === "visiting") filters.push(eq(schema.member.category, "Visitor"));
  if (status === "staying") filters.push(eq(schema.member.category, "Regular Attendee"));
  if (q) {
    const like = `%${q}%`;
    filters.push(ilike(schema.member.fullName, like));
  }

  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(schema.member)
      .where(and(...filters))
      .orderBy(asc(schema.member.fullName))
      .limit(500),
    db
      .select({ category: schema.member.category, n: count() })
      .from(schema.member)
      .where(eq(schema.member.churchId, church.id))
      .groupBy(schema.member.category),
  ]);

  const visitingCount = counts.find((c) => c.category === "Visitor")?.n ?? 0;
  const stayingCount = counts.find((c) => c.category === "Regular Attendee")?.n ?? 0;
  const totalCount = rows.length;

  return (
    <div className="space-y-5 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Akwaaba Reception</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            Register and welcome new people (visiting & staying)
          </p>
        </div>
        <AkwaabaToolbar />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Visiting"
          value={visitingCount}
          sub="guests and visitors"
          icon={Users}
          tone="text-blue-600 bg-blue-50"
        />
        <StatCard
          label="Staying"
          value={stayingCount}
          sub="regular attendees"
          icon={UserCheck}
          tone="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Total Registered"
          value={totalCount}
          sub="people in system"
          icon={HandHeart}
          tone="text-orange-600 bg-orange-50"
        />
      </div>

      <AkwaabaFilters q={q} status={status} />

      {/* Result count hint */}
      {(q || status) && (
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest -mt-2">
          Showing {rows.length} people
        </p>
      )}

      {/* People table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {["Person Profile", "Category", "Contact", "Location", "Status"].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 h-16 text-left align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400 ${i === 0 ? "pl-8" : ""}`}
                >
                  {h}
                </th>
              ))}
              <th className="px-4 pr-8 h-16 text-right align-middle font-black text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <HandHeart className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium italic">
                      {q || status ? "No people match your filters." : "No people registered yet."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((person) => (
                <tr key={person.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 pl-8 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 text-xs font-black">
                        {initials(person.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{person.fullName}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {person.occupation ? person.occupation : "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-slate-600">
                      {person.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p className="font-semibold">{person.phone ?? "—"}</p>
                    {person.email && <p className="text-xs text-slate-400">{person.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{person.address ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tight ${
                      person.category === "Visitor" 
                        ? "bg-blue-50 text-blue-600" 
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {person.category === "Visitor" ? "Visiting" : "Staying"}
                    </span>
                  </td>
                  <td className="px-4 pr-8 py-3 text-right">
                    <PersonRowActions person={person} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <div className="rounded-[2rem] bg-white shadow-xl shadow-slate-200/60 p-6">
      <div className="flex items-start justify-between">
        <div>
          <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase", tone)}>
            {label}
          </span>
          <p className="mt-2 text-5xl font-black text-slate-900">{value}</p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{sub}</p>
    </div>
  );
}
