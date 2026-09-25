import { eq, and, inArray } from "drizzle-orm";
import { GraduationCap, CheckCircle2, Clock, BookOpen } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SobMemberRow } from "./client";

export const metadata = { title: "School of Baptism" };

const TOTAL_LESSONS = 3;

export default async function SobPage() {
  const { church } = await requireChurch();

  // Fetch all active members
  const members = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      category: schema.member.category,
      baptized: schema.member.baptized,
    })
    .from(schema.member)
    .where(and(eq(schema.member.churchId, church.id), eq(schema.member.active, true)))
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

  // Compute summary stats
  const graduated = members.filter((m) => (progressMap.get(m.id)?.length ?? 0) === TOTAL_LESSONS).length;
  const inProgress = members.filter((m) => {
    const c = progressMap.get(m.id)?.length ?? 0;
    return c > 0 && c < TOTAL_LESSONS;
  }).length;
  const notStarted = members.filter((m) => (progressMap.get(m.id)?.length ?? 0) === 0).length;

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
          sub={`of ${members.length} total members`}
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

      {/* Member cards grid */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
          <GraduationCap className="h-12 w-12 opacity-20" />
          <p className="font-bold text-sm">No active members found.</p>
          <p className="text-xs">Add members first to track their SOB progress.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
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
