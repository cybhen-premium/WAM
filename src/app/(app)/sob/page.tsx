import { eq, and, ilike } from "drizzle-orm";
import { GraduationCap, CheckCircle2, Clock, BookOpen } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SobMemberRow, SobToolbar } from "./client";

export const metadata = { title: "School of Baptism" };

const TOTAL_LESSONS = 3;

export default async function SobPage({ searchParams }: PageProps<"/sob">) {
  const { church } = await requireChurch();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = typeof sp.filter === "string" ? sp.filter : "all";

  // Fetch all active members (with optional name search)
  const baseWhere = and(
    eq(schema.member.churchId, church.id),
    eq(schema.member.active, true),
    q ? ilike(schema.member.fullName, `%${q}%`) : undefined,
  );

  const members = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      category: schema.member.category,
      baptized: schema.member.baptized,
    })
    .from(schema.member)
    .where(baseWhere)
    .orderBy(schema.member.fullName);

  // Fetch all SOB progress for this church
  const allProgress = await db
    .select({ memberId: schema.sobProgress.memberId, lesson: schema.sobProgress.lesson })
    .from(schema.sobProgress)
    .where(eq(schema.sobProgress.churchId, church.id));

  // Group lessons by memberId
  const progressMap = new Map<string, number[]>();
  for (const row of allProgress) {
    if (!progressMap.has(row.memberId)) progressMap.set(row.memberId, []);
    progressMap.get(row.memberId)!.push(row.lesson);
  }

  // Apply lesson filter
  const filteredMembers = members.filter((m) => {
    const lessons = progressMap.get(m.id) ?? [];
    const count = lessons.length;
    // lesson1 = completed lesson 1 but NOT lesson 2 yet
    if (filter === "lesson1") return lessons.includes(1) && !lessons.includes(2) && !lessons.includes(3);
    // lesson2 = completed lesson 2 but NOT lesson 3 yet
    if (filter === "lesson2") return lessons.includes(2) && !lessons.includes(3);
    // completed = all 3 done
    if (filter === "completed") return count === TOTAL_LESSONS;
    if (filter === "not_started") return count === 0;
    return true;
  });

  // Compute summary stats (always over all unfiltered members)
  const allMembers = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(and(eq(schema.member.churchId, church.id), eq(schema.member.active, true)));

  const totalCount = allMembers.length;
  const graduated = allMembers.filter((m) => (progressMap.get(m.id)?.length ?? 0) === TOTAL_LESSONS).length;
  const inProgress = allMembers.filter((m) => {
    const c = progressMap.get(m.id)?.length ?? 0;
    return c > 0 && c < TOTAL_LESSONS;
  }).length;
  const notStarted = allMembers.filter((m) => (progressMap.get(m.id)?.length ?? 0) === 0).length;

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">School of Baptism</h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
            Track member progress through the 3 SOB lessons before baptism
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Graduated / Baptized"
          value={graduated}
          sub={`of ${totalCount} total members`}
          icon={CheckCircle2}
          tone="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          sub="started at least 1 lesson"
          icon={BookOpen}
          tone="text-blue-600 bg-blue-50"
        />
        <StatCard
          label="Not Started"
          value={notStarted}
          sub="yet to begin SOB"
          icon={Clock}
          tone="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Toolbar: search + filter */}
      <SobToolbar />

      {/* Result count hint */}
      {(q || filter !== "all") && (
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest -mt-2">
          Showing {filteredMembers.length} of {totalCount} members
        </p>
      )}

      {/* Member cards grid */}
      {filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
          <GraduationCap className="h-12 w-12 opacity-20" />
          <p className="font-bold text-sm">No members found.</p>
          <p className="text-xs">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((m) => (
            <SobMemberRow
              key={m.id}
              member={m}
              completedLessons={progressMap.get(m.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  icon: typeof CheckCircle2;
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
