"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const { messageLog } = schema;

export async function deleteMessageLog(id: string) {
  await requireModule("messaging");
  const { church } = await requireChurch();

  const [deleted] = await db
    .delete(messageLog)
    .where(and(eq(messageLog.id, id), eq(messageLog.churchId, church.id)))
    .returning({ id: messageLog.id, topic: messageLog.topic, kind: messageLog.kind });

  if (!deleted) {
    throw new Error("Message not found or already deleted.");
  }

  logActivity({
    module: "messaging",
    action: `Deleted SMS message log (${deleted.topic || deleted.kind})`,
    metadata: { id: deleted.id, topic: deleted.topic, kind: deleted.kind },
  });

  revalidatePath("/message-center");
  return { ok: true };
}

export async function deleteMessageLogs(ids: string[]) {
  await requireModule("messaging");
  const { church } = await requireChurch();

  if (!ids || ids.length === 0) {
    return { ok: true, count: 0 };
  }

  const deleted = await db
    .delete(messageLog)
    .where(and(inArray(messageLog.id, ids), eq(messageLog.churchId, church.id)))
    .returning({ id: messageLog.id });

  logActivity({
    module: "messaging",
    action: `Deleted ${deleted.length} SMS message log(s)`,
    metadata: { count: deleted.length, ids },
  });

  revalidatePath("/message-center");
  return { ok: true, count: deleted.length };
}
