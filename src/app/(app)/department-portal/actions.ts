"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { sendSms, withFooter } from "@/lib/sms";
import { fillTemplate } from "@/lib/pastoral";
import { logActivity } from "@/lib/activity";

export async function recordSundayAttendance(input: {
  departmentId: string;
  serviceDate: string; // YYYY-MM-DD
  presentMemberIds: string[];
  sendAbsenceSms: boolean;
  notes?: string;
}) {
  await requireModule("department_portal");
  const ctx = await requireChurch();
  const { church, role } = ctx;

  // Only departmental heads can mark the register; admin oversees the data
  if (role === "admin" && !ctx.departmentId) {
    return { error: "Admins cannot mark the register. Only departmental heads can submit attendance." };
  }

  // Authorization check: if user is locked to a department, they can only record for their own department.
  if (ctx.departmentId && ctx.departmentId !== input.departmentId) {
    return { error: "You are only permitted to record attendance for your assigned department." };
  }

  if (!input.serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)) {
    return { error: "A valid date (YYYY-MM-DD) is required." };
  }

  // Fetch department details
  const [dept] = await db
    .select({ id: schema.department.id, name: schema.department.name })
    .from(schema.department)
    .where(and(eq(schema.department.id, input.departmentId), eq(schema.department.churchId, church.id)))
    .limit(1);

  if (!dept) {
    return { error: "Department not found." };
  }

  // Fetch all active members assigned to this department
  const deptMembers = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
    })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.departmentId, input.departmentId),
        eq(schema.member.active, true),
      ),
    );

  if (deptMembers.length === 0) {
    return { error: "No active members found in this department to take attendance for." };
  }

  const presentSet = new Set(input.presentMemberIds);
  const presentMembers = deptMembers.filter((m) => presentSet.has(m.id));
  const absentMembers = deptMembers.filter((m) => !presentSet.has(m.id));

  // Remove existing attendance entries for this department & service date to avoid duplicates
  await db
    .delete(schema.attendance)
    .where(
      and(
        eq(schema.attendance.churchId, church.id),
        eq(schema.attendance.departmentId, input.departmentId),
        eq(schema.attendance.serviceDate, input.serviceDate),
      ),
    );

  // Insert attendance records for all members
  const attendanceRows = [
    ...presentMembers.map((m) => ({
      churchId: church.id,
      departmentId: input.departmentId,
      memberId: m.id,
      serviceDate: input.serviceDate,
      status: "present" as const,
      notes: input.notes ?? null,
    })),
    ...absentMembers.map((m) => ({
      churchId: church.id,
      departmentId: input.departmentId,
      memberId: m.id,
      serviceDate: input.serviceDate,
      status: "absent" as const,
      notes: input.notes ?? null,
    })),
  ];

  if (attendanceRows.length > 0) {
    await db.insert(schema.attendance).values(attendanceRows);
  }

  // Update lastAttendedAt for present members
  if (presentMembers.length > 0) {
    await db
      .update(schema.member)
      .set({ lastAttendedAt: input.serviceDate })
      .where(
        and(
          eq(schema.member.churchId, church.id),
          inArray(
            schema.member.id,
            presentMembers.map((m) => m.id),
          ),
        ),
      );
  }

  let messagesSent = 0;

  // Automated warm message to absentees
  if (input.sendAbsenceSms && absentMembers.length > 0) {
    const template =
      church.absenceTemplate ||
      "Hello [Name], we missed you at church today! We prayed for you and look forward to seeing you next Sunday. Have a blessed week!";

    for (const absent of absentMembers) {
      if (absent.phone) {
        try {
          const personalized = fillTemplate(template, absent.fullName);
          const body = withFooter(church, personalized);
          const res = await sendSms(church, [absent.phone], body, {
            kind: "reach_out",
            topic: `Sunday Absence (${dept.name} - ${input.serviceDate})`,
            audience: absent.fullName,
          });
          if (res.status === "sent" || res.status === "queued") {
            messagesSent++;
          }
        } catch (err) {
          console.error(`Failed to send warm absence SMS to ${absent.fullName}:`, err);
        }
      }
    }
  }

  logActivity({
    module: "department_portal",
    actionCode: "attendance.record",
    action: `Recorded Sunday attendance for ${dept.name} on ${input.serviceDate}: ${presentMembers.length} present, ${absentMembers.length} absent (${messagesSent} warm messages sent)`,
    metadata: {
      departmentId: input.departmentId,
      departmentName: dept.name,
      serviceDate: input.serviceDate,
      presentCount: presentMembers.length,
      absentCount: absentMembers.length,
      messagesSent,
    },
  });

  revalidatePath("/department-portal");
  revalidatePath("/welfare");
  revalidatePath("/dashboard");
  revalidatePath("/members");

  return {
    ok: true,
    presentCount: presentMembers.length,
    absentCount: absentMembers.length,
    messagesSent,
  };
}

export async function saveDepartmentServiceNotes(input: {
  departmentId: string;
  serviceDate: string;
  notes: string;
}) {
  await requireModule("department_portal");
  const ctx = await requireChurch();
  const { church } = ctx;

  if (!input.serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)) {
    return { error: "A valid date (YYYY-MM-DD) is required." };
  }

  await db
    .update(schema.attendance)
    .set({ notes: input.notes.trim() || null })
    .where(
      and(
        eq(schema.attendance.churchId, church.id),
        eq(schema.attendance.departmentId, input.departmentId),
        eq(schema.attendance.serviceDate, input.serviceDate),
      ),
    );

  revalidatePath("/department-portal");
  return { ok: true };
}
