"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMemberSession, destroyMemberSession } from "@/lib/member-portal";
import { logActivity } from "@/lib/activity";

/** Allows member to update their profile picture */
export async function updateMemberPhoto(photoUrl: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getMemberSession();
  if (!session) return { ok: false, error: "Unauthorized. Please log in." };

  if (!photoUrl) {
    return { ok: false, error: "Photo URL or image data is required." };
  }

  await db
    .update(schema.member)
    .set({ photoUrl })
    .where(eq(schema.member.id, session.member.id));

  // Log activity in church audit log
  await logActivity({
    churchId: session.church.id,
    module: "members",
    actionCode: "member_portal.photo_update",
    action: `Member "${session.member.fullName}" updated profile photo via portal`,
    metadata: { memberId: session.member.id },
  }).catch(() => {});

  revalidatePath("/portal");
  revalidatePath("/members");
  return { ok: true };
}

/** Allows member to submit a message, complaint, or pastoral inquiry */
export async function submitMemberInquiry(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await getMemberSession();
  if (!session) return { ok: false, error: "Unauthorized. Please log in." };

  const subject = String(formData.get("subject") ?? "").trim();
  const category = String(formData.get("category") ?? "General Inquiry").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!subject) return { ok: false, error: "Subject is required." };
  if (!message) return { ok: false, error: "Message content is required." };

  await db.insert(schema.memberInquiry).values({
    churchId: session.church.id,
    memberId: session.member.id,
    subject,
    category,
    message,
    status: "pending",
  });

  // Create an administrative notification for church staff
  await db.insert(schema.notification).values({
    churchId: session.church.id,
    type: "member_inquiry",
    title: `New Member Inquiry: ${subject}`,
    message: `${session.member.fullName} (${session.member.memberIdCode || "Member"}) submitted a ${category.toLowerCase()}: "${message.slice(0, 100)}..."`,
    read: false,
    metadata: {
      memberId: session.member.id,
      category,
      subject,
    },
  }).catch(() => {});

  await logActivity({
    churchId: session.church.id,
    module: "welfare",
    actionCode: "member_portal.inquiry_created",
    action: `Member "${session.member.fullName}" submitted ${category}: "${subject}"`,
    metadata: { memberId: session.member.id, category, subject },
  }).catch(() => {});

  revalidatePath("/portal");
  revalidatePath("/welfare");
  return { ok: true };
}

/** Marks a member portal notification as read */
export async function markNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
  const session = await getMemberSession();
  if (!session) return { ok: false };

  await db
    .update(schema.memberNotification)
    .set({ read: true })
    .where(
      and(
        eq(schema.memberNotification.id, notificationId),
        eq(schema.memberNotification.memberId, session.member.id)
      )
    );

  revalidatePath("/portal");
  return { ok: true };
}

/** Marks all member portal notifications as read */
export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await getMemberSession();
  if (!session) return { ok: false };

  await db
    .update(schema.memberNotification)
    .set({ read: true })
    .where(eq(schema.memberNotification.memberId, session.member.id));

  revalidatePath("/portal");
  return { ok: true };
}

/** Signs out of member portal */
export async function logoutMemberPortal(): Promise<void> {
  await destroyMemberSession();
}
