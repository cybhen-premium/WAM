"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export async function clearActivityLogs() {
  await requireModule("analytics");
  const { church } = await requireChurch();

  // 1. Delete all audit activity logs for this church
  await db
    .delete(schema.activityLog)
    .where(eq(schema.activityLog.churchId, church.id));

  // 2. Persist the cleared state for analytics overview
  const clearKey = `analytics_cleared_${church.id}`;
  const now = new Date();
  await db
    .insert(schema.platformSetting)
    .values({
      key: clearKey,
      value: { clearedAt: now.toISOString() },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.platformSetting.key,
      set: {
        value: { clearedAt: now.toISOString() },
        updatedAt: now,
      },
    });

  revalidatePath("/analytics");
  return { ok: true, clearedAt: now.toISOString() };
}

export async function resetDemoAnalytics() {
  await requireModule("analytics");
  const { church } = await requireChurch();

  const clearKey = `analytics_cleared_${church.id}`;
  await db
    .delete(schema.platformSetting)
    .where(eq(schema.platformSetting.key, clearKey));

  revalidatePath("/analytics");
  return { ok: true };
}

export async function recordLogoutAction() {
  try {
    await logActivity({
      module: "auth",
      actionCode: "auth.logout",
      action: "User logged out of the system",
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

