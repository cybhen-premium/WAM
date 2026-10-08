import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Send } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { SearchBox } from "@/components/controls";
import { TablePagination } from "@/components/table-pagination";
import { requireModule } from "@/lib/permissions";
import { MessageList } from "./message-list";

export const metadata = { title: "Message Center" };

const { messageLog } = schema;

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

  const [totalCountResult, rawLogs] = await Promise.all([
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

  const logs = rawLogs.map((l) => ({
    id: l.id,
    churchId: l.churchId,
    channel: l.channel,
    kind: l.kind,
    topic: l.topic,
    audience: l.audience,
    status: l.status,
    recipients: l.recipients,
    body: l.body,
    creditsUsed: l.creditsUsed,
    sentAtFormatted: l.sentAt.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

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

      <div className="rounded-[2rem] bg-white shadow-sm overflow-hidden border border-slate-100">
        <MessageList logs={logs} />
        {logs.length > 0 && (
          <TablePagination
            currentPage={page}
            totalItems={totalItems}
            pageSize={pageSize}
            useUrlParams={true}
          />
        )}
      </div>
    </div>
  );
}
