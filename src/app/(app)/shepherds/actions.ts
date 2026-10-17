"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { generateShepherdCode, hashPassword } from "@/lib/shepherd-portal";

export type FormState = { error?: string; ok?: boolean } | undefined;

/** Creates a new Shepherd in the church */
export async function createShepherd(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireModule("shepherds");
  const { church } = await requireChurch();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!fullName) return { error: "Shepherd full name is required." };
  if (!phone) return { error: "Shepherd phone number is required." };
  if (!password || password.length < 6) {
    return { error: "A password of at least 6 characters is required." };
  }

  try {
    // Check if phone or email already registered as shepherd in this church
    const [existing] = await db
      .select({ id: schema.shepherd.id })
      .from(schema.shepherd)
      .where(
        and(
          eq(schema.shepherd.churchId, church.id),
          eq(schema.shepherd.phone, phone)
        )
      )
      .limit(1);

    if (existing) {
      return { error: "A shepherd with this phone number already exists." };
    }

    const shepherdCode = await generateShepherdCode();
    const passwordHash = hashPassword(password);

    const [created] = await db
      .insert(schema.shepherd)
      .values({
        churchId: church.id,
        fullName,
        phone,
        email: email ? email.toLowerCase() : null,
        passwordHash,
        shepherdCode,
        notes: notes || null,
        active: true,
      })
      .returning();

    logActivity({
      module: "care",
      actionCode: "shepherds.create",
      action: `Registered new Shepherd "${fullName}" (${shepherdCode})`,
      metadata: { shepherdId: created.id, fullName, shepherdCode },
    });

    revalidatePath("/shepherds");
    return { ok: true };
  } catch (err: any) {
    console.error("[createShepherd] error:", err);
    return { error: "Failed to register shepherd. Please try again." };
  }
}

/** Updates a Shepherd's profile or status */
export async function updateShepherd(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireModule("shepherds");
  const { church } = await requireChurch();

  const id = String(formData.get("id") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const active = formData.get("active") === "true";

  if (!id) return { error: "Shepherd ID is missing." };
  if (!fullName) return { error: "Shepherd full name is required." };
  if (!phone) return { error: "Shepherd phone number is required." };

  try {
    await db
      .update(schema.shepherd)
      .set({
        fullName,
        phone,
        email: email ? email.toLowerCase() : null,
        notes: notes || null,
        active,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.shepherd.id, id), eq(schema.shepherd.churchId, church.id)));

    logActivity({
      module: "care",
      actionCode: "shepherds.update",
      action: `Updated Shepherd profile for "${fullName}"`,
      metadata: { shepherdId: id, fullName },
    });

    revalidatePath("/shepherds");
    revalidatePath("/shepherd-portal");
    return { ok: true };
  } catch (err: any) {
    console.error("[updateShepherd] error:", err);
    return { error: "Failed to update shepherd." };
  }
}

/** Resets a Shepherd's password */
export async function resetShepherdPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireModule("shepherds");
  const { church } = await requireChurch();

  const id = String(formData.get("id") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "").trim();

  if (!id) return { error: "Shepherd ID is missing." };
  if (!newPassword || newPassword.length < 6) {
    return { error: "New password must be at least 6 characters." };
  }

  try {
    const passwordHash = hashPassword(newPassword);

    await db
      .update(schema.shepherd)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(schema.shepherd.id, id), eq(schema.shepherd.churchId, church.id)));

    // Invalidate existing sessions
    await db
      .delete(schema.shepherdSession)
      .where(eq(schema.shepherdSession.shepherdId, id));

    logActivity({
      module: "care",
      actionCode: "shepherds.reset_password",
      action: `Reset password for Shepherd ID: ${id}`,
      metadata: { shepherdId: id },
    });

    revalidatePath("/shepherds");
    return { ok: true };
  } catch (err: any) {
    console.error("[resetShepherdPassword] error:", err);
    return { error: "Failed to reset shepherd password." };
  }
}

/** Deletes a Shepherd */
export async function deleteShepherd(shepherdId: string): Promise<FormState> {
  await requireModule("shepherds");
  const { church } = await requireChurch();

  try {
    await db
      .delete(schema.shepherd)
      .where(and(eq(schema.shepherd.id, shepherdId), eq(schema.shepherd.churchId, church.id)));

    logActivity({
      module: "care",
      actionCode: "shepherds.delete",
      action: `Deleted Shepherd record (ID: ${shepherdId})`,
      metadata: { shepherdId },
    });

    revalidatePath("/shepherds");
    return { ok: true };
  } catch (err: any) {
    console.error("[deleteShepherd] error:", err);
    return { error: "Failed to delete shepherd." };
  }
}

/** Assigns one or more disciples to a shepherd from the admin view */
export async function adminAssignDisciples(
  shepherdId: string,
  assignments: Array<{ memberId: string; source: string }>
): Promise<{ ok: boolean; count?: number; error?: string }> {
  await requireModule("shepherds");
  const { church } = await requireChurch();

  if (!shepherdId) {
    return { ok: false, error: "Shepherd is required." };
  }
  if (!assignments || assignments.length === 0) {
    return { ok: false, error: "Please select at least one disciple to assign." };
  }

  try {
    for (const item of assignments) {
      const src = item.source === "sob" ? "sob" : "member";
      const [existing] = await db
        .select({ id: schema.shepherdDisciple.id })
        .from(schema.shepherdDisciple)
        .where(
          and(
            eq(schema.shepherdDisciple.churchId, church.id),
            eq(schema.shepherdDisciple.memberId, item.memberId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(schema.shepherdDisciple)
          .set({
            shepherdId,
            active: true,
            source: src,
            assignedAt: sql`CURRENT_DATE`,
          })
          .where(eq(schema.shepherdDisciple.id, existing.id));
      } else {
        await db.insert(schema.shepherdDisciple).values({
          churchId: church.id,
          shepherdId,
          memberId: item.memberId,
          source: src,
          active: true,
        });
      }
    }

    logActivity({
      module: "care",
      actionCode: "shepherds.assign_disciples",
      action: `Assigned ${assignments.length} disciple(s) to Shepherd (ID: ${shepherdId})`,
      metadata: { shepherdId, count: assignments.length },
    });

    revalidatePath("/shepherds");
    revalidatePath("/shepherd-portal");
    return { ok: true, count: assignments.length };
  } catch (err: any) {
    console.error("[adminAssignDisciples] error:", err);
    return { ok: false, error: "Failed to assign disciples. Please try again." };
  }
}

/** Assigns a single disciple to a shepherd from the admin view (wrapper) */
export async function adminAssignDisciple(
  shepherdId: string,
  memberId: string,
  source: string = "member"
): Promise<{ ok: boolean; error?: string }> {
  const res = await adminAssignDisciples(shepherdId, [{ memberId, source }]);
  return { ok: res.ok, error: res.error };
}

/** Fetches full flock details for a specific shepherd (for admin drill-down) */
export async function getShepherdFlockDetails(shepherdId: string) {
  await requireModule("shepherds");
  const { church } = await requireChurch();

  const [disciples, attendance, spiritualLogs] = await Promise.all([
    db
      .select({
        disciple: schema.shepherdDisciple,
        member: schema.member,
      })
      .from(schema.shepherdDisciple)
      .innerJoin(schema.member, eq(schema.member.id, schema.shepherdDisciple.memberId))
      .where(
        and(
          eq(schema.shepherdDisciple.churchId, church.id),
          eq(schema.shepherdDisciple.shepherdId, shepherdId),
          eq(schema.shepherdDisciple.active, true)
        )
      )
      .orderBy(schema.member.fullName),

    db
      .select({
        att: schema.shepherdAttendance,
        memberName: schema.member.fullName,
      })
      .from(schema.shepherdAttendance)
      .innerJoin(schema.member, eq(schema.member.id, schema.shepherdAttendance.memberId))
      .where(
        and(
          eq(schema.shepherdAttendance.churchId, church.id),
          eq(schema.shepherdAttendance.shepherdId, shepherdId)
        )
      )
      .orderBy(desc(schema.shepherdAttendance.serviceDate))
      .limit(50),

    db
      .select({
        log: schema.shepherdSpiritualLog,
        memberName: schema.member.fullName,
      })
      .from(schema.shepherdSpiritualLog)
      .innerJoin(schema.member, eq(schema.member.id, schema.shepherdSpiritualLog.memberId))
      .where(
        and(
          eq(schema.shepherdSpiritualLog.churchId, church.id),
          eq(schema.shepherdSpiritualLog.shepherdId, shepherdId)
        )
      )
      .orderBy(desc(schema.shepherdSpiritualLog.logDate))
      .limit(30),
  ]);

  return { disciples, attendance, spiritualLogs };
}
