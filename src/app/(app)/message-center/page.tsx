import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Send } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SearchBox } from "@/components/controls";
import { TablePagination } from "@/components/table-pagination";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Message Center" };

const { messageLog } = schema;

const STATUS: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700",
  queued: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
};

export default async function MessageCenterPage({ searchParams }: PageProps<"/message-center">) {
  const { church } = await requireChurch();
  await requireModule("messaging");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = Math.max(1, Number(sp.pageSize) || 50);
  const like = `%${q}%`;

  const where = and(
    eq(messageLog.churchId, church.id),
    q ? or(ilike(messageLog.body, like), ilike(messageLog.topic, like), ilike(messageLog.audience, like)) : undefined,
  );

  const [totalCountResult, logs] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(messageLog).where(where),
    db
      .select()
      .from(messageLog)
      .where(where)
      .orderBy(desc(messageLog.sentAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const totalItems = Number(totalCountResult[0]?.count ?? 0);

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase text-slate-900 tracking-tight">Message Center</h1>
          <p className="text-sm text-slate-500">Track all SMS communications</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox placeholder="Search messages..." initial={q} />
          <Link
            href="/announcements"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e3a8a] text-white hover:bg-blue-900"
            title="New broadcast"
            aria-label="New broadcast"
          >
            <Send className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="rounded-[2rem] bg-white shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-black text-slate-800">No History Recorded</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your SMS logs will appear here</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-50">
              {logs.map((l) => (
                <li key={l.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase", STATUS[l.status] ?? STATUS.queued)}>
                      {l.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">
                      {l.kind.replace("_", " ")}
                    </span>
                    {l.kind === "broadcast" && l.topic && <span className="text-sm font-black text-slate-900">{l.topic}</span>}
                    <span className="ml-auto text-[11px] font-semibold text-slate-400">
                      {l.sentAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600 line-clamp-3">{l.body}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    To {l.audience ?? "—"} · {l.recipients} recipient{l.recipients === 1 ? "" : "s"} · {l.creditsUsed} credits
                  </p>
                </li>
              ))}
            </ul>
            <TablePagination
              currentPage={page}
              totalItems={totalItems}
              pageSize={pageSize}
              useUrlParams={true}
            />
          </>
        )}
      </div>
    </div>
  );
}
