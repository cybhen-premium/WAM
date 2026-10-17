"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireShepherd, destroyShepherdSession } from "@/lib/shepherd-portal";

/** Signs the shepherd out and redirects to login */
export async function logoutShepherd() {
  await destroyShepherdSession();
  redirect("/shepherd/login");
}

/** Searches for members and SOB candidates available to be added as disciples */
export async function searchAvailableDisciples(query: string = "") {
  const { shepherd, church } = await requireShepherd();

  // 1. Get member IDs already assigned to this shepherd
  const assigned = await db
    .select({ memberId: schema.shepherdDisciple.memberId })
    .from(schema.shepherdDisciple)
    .where(
      and(
        eq(schema.shepherdDisciple.churchId, church.id),
        eq(schema.shepherdDisciple.shepherdId, shepherd.id),
        eq(schema.shepherdDisciple.active, true)
      )
    );
  const assignedMemberIds = new Set(assigned.map((a) => a.memberId));

  // 2. Fetch candidates from members table
  const cleanQ = query.trim();
  const searchFilter = cleanQ
    ? or(
        ilike(schema.member.fullName, `%${cleanQ}%`),
        ilike(schema.member.phone, `%${cleanQ}%`),
        ilike(schema.member.category, `%${cleanQ}%`)
      )
    : undefined;

  const members = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      photoUrl: schema.member.photoUrl,
      category: schema.member.category,
      gender: schema.member.gender,
      fromAkwaaba: schema.member.fromAkwaaba,
    })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.active, true),
        searchFilter
      )
    )
    .orderBy(schema.member.fullName)
    .limit(50);

  // Filter out already assigned
  return members
    .filter((m) => !assignedMemberIds.has(m.id))
    .map((m) => {
      const isSob = m.category === "Regular Attendee" || m.fromAkwaaba;
      return {
        ...m,
        source: (isSob ? "sob" : "member") as "sob" | "member",
        sourceLabel: isSob ? "School of Baptism (SOB)" : "Church Member",
      };
    });
}

/** Assigns a disciple to the logged-in shepherd */
export async function addDiscipleToFlock(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { shepherd, church } = await requireShepherd();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const source = String(formData.get("source") ?? "member").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!memberId) return { ok: false, error: "Please select a member or SOB candidate." };

  try {
    // Check if already assigned to this shepherd
    const [existing] = await db
      .select({ id: schema.shepherdDisciple.id, active: schema.shepherdDisciple.active })
      .from(schema.shepherdDisciple)
      .where(
        and(
          eq(schema.shepherdDisciple.churchId, church.id),
          eq(schema.shepherdDisciple.shepherdId, shepherd.id),
          eq(schema.shepherdDisciple.memberId, memberId)
        )
      )
      .limit(1);

    if (existing) {
      if (!existing.active) {
        await db
          .update(schema.shepherdDisciple)
          .set({ active: true, notes: notes || null })
          .where(eq(schema.shepherdDisciple.id, existing.id));
      } else {
        return { ok: false, error: "This disciple is already part of your flock." };
      }
    } else {
      await db.insert(schema.shepherdDisciple).values({
        churchId: church.id,
        shepherdId: shepherd.id,
        memberId,
        source: source === "sob" ? "sob" : "member",
        notes: notes || null,
        active: true,
      });
    }

    revalidatePath("/shepherd-portal");
    revalidatePath("/shepherds");
    return { ok: true };
  } catch (err: any) {
    console.error("[addDiscipleToFlock] error:", err);
    return { ok: false, error: "Failed to add disciple. Please try again." };
  }
}

/** Removes/unassigns a disciple from the shepherd's flock */
export async function removeDiscipleFromFlock(discipleId: string): Promise<{ ok: boolean; error?: string }> {
  const { shepherd, church } = await requireShepherd();

  try {
    await db
      .update(schema.shepherdDisciple)
      .set({ active: false })
      .where(
        and(
          eq(schema.shepherdDisciple.id, discipleId),
          eq(schema.shepherdDisciple.shepherdId, shepherd.id),
          eq(schema.shepherdDisciple.churchId, church.id)
        )
      );

    revalidatePath("/shepherd-portal");
    revalidatePath("/shepherds");
    return { ok: true };
  } catch (err: any) {
    console.error("[removeDiscipleFromFlock] error:", err);
    return { ok: false, error: "Failed to remove disciple." };
  }
}

/** Records service attendance for one or more disciples */
export async function recordServiceAttendance(
  serviceDate: string,
  serviceType: string,
  customProgramName: string | null,
  attendees: { memberId: string; status: "Present" | "Absent" | "Late" | "Excused"; notes?: string }[]
): Promise<{ ok: boolean; error?: string }> {
  const { shepherd, church } = await requireShepherd();

  if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return { ok: false, error: "Valid service date is required." };
  }
  if (!serviceType) {
    return { ok: false, error: "Please select a service or program type." };
  }
  if (serviceType === "Custom" && !customProgramName?.trim()) {
    return { ok: false, error: "Please enter the custom program name." };
  }
  if (!attendees || attendees.length === 0) {
    return { ok: false, error: "No disciples marked for attendance." };
  }

  try {
    for (const att of attendees) {
      // Check if record exists for this member, date, and service
      const [existing] = await db
        .select({ id: schema.shepherdAttendance.id })
        .from(schema.shepherdAttendance)
        .where(
          and(
            eq(schema.shepherdAttendance.churchId, church.id),
            eq(schema.shepherdAttendance.shepherdId, shepherd.id),
            eq(schema.shepherdAttendance.memberId, att.memberId),
            eq(schema.shepherdAttendance.serviceDate, serviceDate),
            eq(schema.shepherdAttendance.serviceType, serviceType)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(schema.shepherdAttendance)
          .set({
            status: att.status,
            customProgramName: customProgramName?.trim() || null,
            notes: att.notes?.trim() || null,
          })
          .where(eq(schema.shepherdAttendance.id, existing.id));
      } else {
        await db.insert(schema.shepherdAttendance).values({
          churchId: church.id,
          shepherdId: shepherd.id,
          memberId: att.memberId,
          serviceDate,
          serviceType,
          customProgramName: customProgramName?.trim() || null,
          status: att.status,
          notes: att.notes?.trim() || null,
        });
      }
    }

    revalidatePath("/shepherd-portal");
    revalidatePath("/shepherds");
    return { ok: true };
  } catch (err: any) {
    console.error("[recordServiceAttendance] error:", err);
    return { ok: false, error: "Failed to save service attendance." };
  }
}

/** Records a spiritual life check-in for a disciple (Quiet Time & Prayer Life) */
export async function recordSpiritualEvaluation(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { shepherd, church } = await requireShepherd();

  const memberId = String(formData.get("memberId") ?? "").trim();
  const logDate = String(formData.get("logDate") ?? "").trim();
  const quietTimeConsistency = String(formData.get("quietTimeConsistency") ?? "Daily").trim();
  const quietTimeScripture = String(formData.get("quietTimeScripture") ?? "").trim();
  const prayerLifeRating = String(formData.get("prayerLifeRating") ?? "Consistent").trim();
  const prayerFocusNotes = String(formData.get("prayerFocusNotes") ?? "").trim();
  const spiritualStatus = String(formData.get("spiritualStatus") ?? "Steady").trim();
  const shepherdRemarks = String(formData.get("shepherdRemarks") ?? "").trim();

  if (!memberId) return { ok: false, error: "Disciple ID is required." };
  if (!logDate || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return { ok: false, error: "Valid date is required." };
  }

  try {
    await db.insert(schema.shepherdSpiritualLog).values({
      churchId: church.id,
      shepherdId: shepherd.id,
      memberId,
      logDate,
      quietTimeConsistency,
      quietTimeScripture: quietTimeScripture || null,
      prayerLifeRating,
      prayerFocusNotes: prayerFocusNotes || null,
      spiritualStatus,
      shepherdRemarks: shepherdRemarks || null,
    });

    revalidatePath("/shepherd-portal");
    revalidatePath("/shepherds");
    return { ok: true };
  } catch (err: any) {
    console.error("[recordSpiritualEvaluation] error:", err);
    return { ok: false, error: "Failed to record spiritual evaluation." };
  }
}
