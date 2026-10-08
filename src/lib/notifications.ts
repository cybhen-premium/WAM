import "server-only";

import { desc, eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/auth";

export type NotificationItem = {
  id: string;
  churchId: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type CreateNotificationOptions = {
  churchId: string;
  userId?: string | null;
  type?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  sendEmailAlert?: boolean;
  emailTo?: string;
};

/**
 * Creates an in-app notification and optionally dispatches an email alert to the admin.
 */
export async function createNotification(opts: CreateNotificationOptions) {
  try {
    const { churchId, userId = null, type = "staff_login", title, message, metadata = {} } = opts;

    // 1. Insert notification record into DB
    const [inserted] = await db
      .insert(schema.notification)
      .values({
        churchId,
        userId: userId ?? null,
        type,
        title,
        message,
        read: false,
        metadata,
      })
      .returning();

    // 2. Dispatch email alert if requested
    if (opts.sendEmailAlert) {
      let recipientEmail = opts.emailTo;

      // If no explicit recipient provided, resolve church owner's email
      if (!recipientEmail) {
        const [churchRow] = await db
          .select({ ownerId: schema.church.ownerId })
          .from(schema.church)
          .where(eq(schema.church.id, churchId))
          .limit(1);

        if (churchRow?.ownerId) {
          const [ownerUser] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, churchRow.ownerId))
            .limit(1);

          recipientEmail = ownerUser?.email;
        }
      }

      if (recipientEmail) {
        const staffName = (metadata.actorName as string) || "Staff Member";
        const staffEmail = (metadata.actorEmail as string) || "N/A";
        const role = (metadata.role as string) || "Staff";
        const branchName = (metadata.branchName as string) || "Sanctuary";
        const device = (metadata.device as string) || "Desktop";
        const os = (metadata.os as string) || "N/A";
        const browser = (metadata.browser as string) || "N/A";
        const ipAddress = (metadata.ipAddress as string) || "Unknown";
        const formattedDate = new Date().toLocaleString("en-US", {
          timeZone: "UTC",
          dateStyle: "full",
          timeStyle: "medium",
        });

        const emailSubject = `🔔 Staff Login Alert: ${staffName} (${role})`;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #0f172a; padding: 24px; color: #ffffff; text-align: center; }
    .badge { display: inline-block; background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px; }
    .title { font-size: 19px; font-weight: 900; margin: 0; color: #ffffff; }
    .body { padding: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
    .intro { margin-top: 0; margin-bottom: 20px; font-size: 14px; color: #475569; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .info-table tr:nth-child(even) { background-color: #f8fafc; }
    .info-table td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    .info-label { font-weight: 700; color: #64748b; width: 38%; }
    .info-val { font-weight: 600; color: #0f172a; }
    .footer-note { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #92400e; margin-top: 20px; }
    .btn-container { text-align: center; margin-top: 24px; margin-bottom: 10px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 10px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
    .copyright { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Security Notification</div>
      <h1 class="title">Staff Member Logged In</h1>
    </div>
    <div class="body">
      <p class="intro">
        Hello Administrator, a staff member has just logged into the church portal. Here are the details of this session:
      </p>

      <table class="info-table">
        <tr>
          <td class="info-label">Staff Name</td>
          <td class="info-val">${staffName}</td>
        </tr>
        <tr>
          <td class="info-label">Staff Email</td>
          <td class="info-val">${staffEmail}</td>
        </tr>
        <tr>
          <td class="info-label">Assigned Role</td>
          <td class="info-val">${role}</td>
        </tr>
        <tr>
          <td class="info-label">Church Branch</td>
          <td class="info-val">${branchName}</td>
        </tr>
        <tr>
          <td class="info-label">Device & OS</td>
          <td class="info-val">${device} (${os} · ${browser})</td>
        </tr>
        <tr>
          <td class="info-label">IP Address</td>
          <td class="info-val">${ipAddress}</td>
        </tr>
        <tr>
          <td class="info-label">Timestamp</td>
          <td class="info-val">${formattedDate} UTC</td>
        </tr>
      </table>

      <div class="btn-container">
        <a href="http://localhost:3000/staffs" class="btn">Manage Staff & Permissions</a>
      </div>

      <div class="footer-note">
        <strong>Security Notice:</strong> If this login was unexpected or unrecognized, please review your Staff Management settings and revoke access immediately.
      </div>
    </div>
  </div>
  <div class="copyright">
    World Ark Missions Church Management System · Automated Security Alert
  </div>
</body>
</html>
        `;

        await sendEmail({
          to: recipientEmail,
          subject: emailSubject,
          html,
        }).catch((err) => {
          console.error("[Notification] Failed to dispatch login alert email:", err);
        });
      }
    }

    return inserted;
  } catch (err) {
    console.error("[Notification] Error creating notification:", err);
    return null;
  }
}

/**
 * Returns unread notifications count for a given church.
 */
export async function getUnreadNotificationsCount(churchId: string): Promise<number> {
  try {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.notification)
      .where(and(eq(schema.notification.churchId, churchId), eq(schema.notification.read, false)));

    return Number(n) || 0;
  } catch (err) {
    console.error("[Notification] Error counting unread notifications:", err);
    return 0;
  }
}

/**
 * Returns recent notifications for a church.
 */
export async function getRecentNotifications(
  churchId: string,
  limit = 20,
): Promise<NotificationItem[]> {
  try {
    const rows = await db
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.churchId, churchId))
      .orderBy(desc(schema.notification.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      metadata: r.metadata as Record<string, unknown> | null,
    }));
  } catch (err) {
    console.error("[Notification] Error fetching notifications:", err);
    return [];
  }
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(id: string) {
  try {
    await db
      .update(schema.notification)
      .set({ read: true })
      .where(eq(schema.notification.id, id));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Marks all notifications for a church as read.
 */
export async function markAllNotificationsAsRead(churchId: string) {
  try {
    await db
      .update(schema.notification)
      .set({ read: true })
      .where(and(eq(schema.notification.churchId, churchId), eq(schema.notification.read, false)));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
