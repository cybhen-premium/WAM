"use server";

import { requireChurch } from "@/lib/session";
import {
  getRecentNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/notifications";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getNotificationsAction() {
  try {
    const { church, user } = await requireChurch();
    const [unreadCount, items] = await Promise.all([
      getUnreadNotificationsCount(church.id),
      getRecentNotifications(church.id, 25),
    ]);

    return {
      ok: true,
      unreadCount,
      items: items.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        message: i.message,
        read: i.read,
        metadata: i.metadata,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    return { ok: false, unreadCount: 0, items: [] };
  }
}

export async function markNotificationReadAction(id: string) {
  try {
    const { church } = await requireChurch();
    await db
      .update(schema.notification)
      .set({ read: true })
      .where(and(eq(schema.notification.id, id), eq(schema.notification.churchId, church.id)));

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const { church } = await requireChurch();
    await markAllNotificationsAsRead(church.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function clearNotificationAction(id: string) {
  try {
    const { church } = await requireChurch();
    await db
      .delete(schema.notification)
      .where(and(eq(schema.notification.id, id), eq(schema.notification.churchId, church.id)));

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
