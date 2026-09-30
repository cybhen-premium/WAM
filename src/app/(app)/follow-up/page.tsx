import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { CircleCheckBig, House, Phone, UserPlus, Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AddToPipelineButton, FollowUpCard } from "./follow-up-client";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Follow-up Pipeline" };

const { followUp, member } = schema;

/** The pipeline tracks Akwaaba visitors only — full members and regular attendees are followed up elsewhere. */
const VISITOR_CATEGORY = "Visitor";

const COLUMNS = [
  { stage: "new", label: "New", icon: UserPlus, tone: "text-blue-600 bg-blue-50", bar: "bg-blue-500" },
  { stage: "contacted", label: "Contacted", icon: Phone, tone: "text-amber-600 bg-amber-50", bar: "bg-amber-500" },
  { stage: "visited", label: "Visited", icon: House, tone: "text-purple-600 bg-purple-50", bar: "bg-purple-500" },
  { stage: "integrated", label: "Integrated", icon: CircleCheckBig, tone: "text-emerald-600 bg-emerald-50", bar: "bg-emerald-500" },
] as const;

export default async function FollowUpPage() {
  const { church } = await requireChurch();
  await requireModule("care");

  const entries = await db
    .select({ f: followUp, fullName: member.fullName, phone: member.phone, category: member.category })
    .from(followUp)
    .innerJoin(member, eq(member.id, followUp.memberId))
    .where(and(eq(followUp.churchId, church.id), eq(member.category, VISITOR_CATEGORY)))
    .orderBy(desc(followUp.updatedAt));

  const inPipeline = entries.map((e) => e.f.memberId);
  const candidates = await db
    .select({ id: member.id, fullName: member.fullName })
    .from(member)
    .where(
      and(
        eq(member.churchId, church.id),
        eq(member.active, true),
        eq(member.category, VISITOR_CATEGORY),
        inPipeline.length ? notInArray(member.id, inPipeline) : undefined,
      ),
    )
    .orderBy(asc(member.fullName));

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1e3a8a] text-white shadow-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Follow-up Pipeline</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Track and nurture the visitors you have received
            </p>
          </div>
        </div>
        <AddToPipelineButton members={candidates} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col, i) => {
          const items = entries.filter((e) => e.f.stage === col.stage);
          const Icon = col.icon;
          return (
            <section key={col.stage} className="rounded-[1.75rem] bg-slate-100/70 p-3 min-h-[320px]">
              <header className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", col.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">{col.label}</h2>
                </div>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-black text-slate-600 shadow-sm">{items.length}</span>
              </header>
              <div className={cn("mx-2 mb-3 h-1 rounded-full", col.bar)} />
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">No entries</p>
                ) : (
                  items.map(({ f, fullName, phone, category }) => (
                    <FollowUpCard
                      key={f.id}
                      entry={{
                        id: f.id,
                        fullName,
                        phone,
                        category,
                        kind: f.kind,
                        notes: f.notes ?? "",
                        assignedTo: f.assignedTo ?? "",
                        days: Math.floor((Date.now() - f.createdAt.getTime()) / 86_400_000),
                      }}
                      prev={i > 0 ? COLUMNS[i - 1].stage : null}
                      next={i < COLUMNS.length - 1 ? COLUMNS[i + 1].stage : null}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
