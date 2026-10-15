"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { hashPassword } from "better-auth/crypto";
import { resolveAppUrl } from "@/lib/notifications";
import { sendStaffWelcomeEmail } from "@/lib/email";

const { department } = schema;

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined;

export async function saveDepartment(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("departments");
  const { church } = await requireChurch();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Department name is required." };

  const id = String(form.get("id") ?? "");
  if (id) {
    await db
      .update(department)
      .set({ name })
      .where(and(eq(department.id, id), eq(department.churchId, church.id)));
    logActivity({
      module: "departments",
      actionCode: "departments.update",
      action: `Updated department "${name}"`,
      metadata: { departmentId: id, name },
    });
  } else {
    await db.insert(department).values({ name, churchId: church.id });
    logActivity({
      module: "departments",
      actionCode: "departments.create",
      action: `Created department "${name}"`,
      metadata: { name },
    });
  }

  revalidatePath("/departments");
  revalidatePath("/members");
  return { ok: true };
}

export async function deleteDepartment(id: string) {
  await requireModule("departments");
  const { church } = await requireChurch();
  await db.delete(department).where(and(eq(department.id, id), eq(department.churchId, church.id)));
  logActivity({
    module: "departments",
    actionCode: "departments.delete",
    action: "Deleted department",
    metadata: { departmentId: id },
  });
  revalidatePath("/departments");
  revalidatePath("/members");
}

export async function assignDepartmentAccount(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  await requireModule("departments");
  const { church, role } = await requireChurch();
  if (role !== "admin") return { error: "Only admins can assign department accounts." };

  const deptId = String(form.get("departmentId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const emailRaw = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "").trim() || "WAMCHURCH@26";

  if (!deptId) return { error: "Department is required." };
  if (!name) return { error: "Leader full name is required." };
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { error: "Enter a valid personal email address." };
  }

  const [dept] = await db
    .select()
    .from(schema.department)
    .where(and(eq(schema.department.id, deptId), eq(schema.department.churchId, church.id)))
    .limit(1);
  if (!dept) return { error: "Department not found." };

  // 1. Check if user already exists in the system (by personal email)
  const [existingUser] = await db
    .select({ id: schema.user.id, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.email, emailRaw))
    .limit(1);

  let finalUserId = existingUser?.id;
  const now = new Date();
  const hashed = await hashPassword(password);
  let isNewUser = false;

  if (!finalUserId) {
    isNewUser = true;
    finalUserId = crypto.randomUUID().replace(/-/g, "");
    const accountId = crypto.randomUUID().replace(/-/g, "");

    await db.insert(schema.user).values({
      id: finalUserId,
      name,
      email: emailRaw,
      emailVerified: true,
      passwordChangeRequired: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.account).values({
      id: accountId,
      accountId: finalUserId,
      providerId: "credential",
      userId: finalUserId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // Prevent modifying church owner account via department assignment
    if (finalUserId === church.ownerId) {
      return { error: "The church owner account cannot be assigned as a department account." };
    }

    // Existing user: ensure credential account exists or update password if provided
    const [existingAccount] = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, finalUserId), eq(schema.account.providerId, "credential")))
      .limit(1);

    if (!existingAccount) {
      const accountId = crypto.randomUUID().replace(/-/g, "");
      await db.insert(schema.account).values({
        id: accountId,
        accountId: finalUserId,
        providerId: "credential",
        userId: finalUserId,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      });
    } else if (form.get("password")) {
      await db
        .update(schema.account)
        .set({ password: hashed, updatedAt: now })
        .where(eq(schema.account.id, existingAccount.id));
      await db
        .update(schema.user)
        .set({ passwordChangeRequired: true, updatedAt: now })
        .where(eq(schema.user.id, finalUserId));
    }
  }

  // 2. If a different staff member is currently assigned to this department, unassign them safely
  const [currentDeptStaff] = await db
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.churchId, church.id), eq(schema.staff.departmentId, dept.id)))
    .limit(1);

  if (currentDeptStaff && currentDeptStaff.userId !== finalUserId) {
    if (currentDeptStaff.role === "Department Lead") {
      await db.delete(schema.staffModule).where(eq(schema.staffModule.staffId, currentDeptStaff.id));
      await db.delete(schema.staff).where(eq(schema.staff.id, currentDeptStaff.id));
    } else {
      await db.update(schema.staff).set({ departmentId: null }).where(eq(schema.staff.id, currentDeptStaff.id));
      await db
        .delete(schema.staffModule)
        .where(and(eq(schema.staffModule.staffId, currentDeptStaff.id), eq(schema.staffModule.module, "department_portal")));
    }
  }

  // 3. Link or create target user's staff row for this church
  const [existingUserStaff] = await db
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.churchId, church.id), eq(schema.staff.userId, finalUserId)))
    .limit(1);

  let targetStaffId: string;

  if (existingUserStaff) {
    targetStaffId = existingUserStaff.id;
    await db
      .update(schema.staff)
      .set({
        departmentId: dept.id,
        email: emailRaw,
        status: "active",
      })
      .where(eq(schema.staff.id, existingUserStaff.id));
  } else {
    const [newStaff] = await db
      .insert(schema.staff)
      .values({
        churchId: church.id,
        userId: finalUserId,
        email: emailRaw,
        role: "Department Lead",
        departmentId: dept.id,
        status: "active",
      })
      .returning({ id: schema.staff.id });

    targetStaffId = newStaff.id;
  }

  logActivity({
    module: "departments",
    actionCode: "department.account.create",
    action: `Assigned "${name}" (${emailRaw}) to lead "${dept.name}"`,
    metadata: { departmentId: dept.id, email: emailRaw, name, staffId: targetStaffId },
  });

  // 4. Send welcome email with login URL and default password to their personal email
  const appUrl = await resolveAppUrl();
  const loginUrl = `${appUrl}/login`;
  try {
    await sendStaffWelcomeEmail({
      to: emailRaw,
      name,
      role: `${dept.name} Lead`,
      churchName: church.name,
      branches: church.name,
      loginUrl,
      temporaryPassword: password,
      isReset: !isNewUser && Boolean(form.get("password")),
    });
  } catch (emailErr) {
    console.error("Failed to send department lead credentials email:", emailErr);
  }

  revalidatePath("/departments");
  revalidatePath("/staffs");
  return { ok: true, message: `Department leader assigned! Credentials sent to ${emailRaw}.` };
}

export async function resendDepartmentCredentials(deptId: string): Promise<FormState> {
  await requireModule("departments");
  const { church, role } = await requireChurch();
  if (role !== "admin") return { error: "Only admins can resend credentials." };

  const [dept] = await db
    .select()
    .from(schema.department)
    .where(and(eq(schema.department.id, deptId), eq(schema.department.churchId, church.id)))
    .limit(1);
  if (!dept) return { error: "Department not found." };

  const [assignedStaff] = await db
    .select({
      id: schema.staff.id,
      email: schema.staff.email,
      name: schema.user.name,
    })
    .from(schema.staff)
    .leftJoin(schema.user, eq(schema.user.id, schema.staff.userId))
    .where(and(eq(schema.staff.churchId, church.id), eq(schema.staff.departmentId, dept.id)))
    .limit(1);

  if (!assignedStaff) return { error: "No leader assigned to this department." };

  const appUrl = await resolveAppUrl();
  const loginUrl = `${appUrl}/login`;
  const defaultPassword = "WAMCHURCH@26";

  try {
    await sendStaffWelcomeEmail({
      to: assignedStaff.email,
      name: assignedStaff.name || assignedStaff.email.split("@")[0],
      role: `${dept.name} Lead`,
      churchName: church.name,
      branches: church.name,
      loginUrl,
      temporaryPassword: defaultPassword,
    });
    return { ok: true, message: `Login URL and default password sent to ${assignedStaff.email}.` };
  } catch (err: any) {
    console.error("Failed to resend credentials:", err);
    return { error: err?.message || "Failed to send credentials email." };
  }
}

export async function removeDepartmentAccount(deptId: string) {
  await requireModule("members");
  const { church, role } = await requireChurch();
  if (role !== "admin") throw new Error("Only admins can manage department accounts.");

  const [existing] = await db
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.churchId, church.id), eq(schema.staff.departmentId, deptId)))
    .limit(1);

  if (existing) {
    if (existing.role === "Department Lead") {
      await db.delete(schema.staffModule).where(eq(schema.staffModule.staffId, existing.id));
      await db.delete(schema.staff).where(eq(schema.staff.id, existing.id));
    } else {
      // Staff member has another role. Only remove their department assignment & department_portal module!
      await db.update(schema.staff).set({ departmentId: null }).where(eq(schema.staff.id, existing.id));
      await db
        .delete(schema.staffModule)
        .where(and(eq(schema.staffModule.staffId, existing.id), eq(schema.staffModule.module, "department_portal")));
    }
  }

  logActivity({
    module: "departments",
    actionCode: "department.account.remove",
    action: `Removed leader login assignment for department`,
    metadata: { departmentId: deptId },
  });

  revalidatePath("/departments");
  revalidatePath("/staffs");
}
