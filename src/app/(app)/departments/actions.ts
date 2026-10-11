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

export type FormState = { error?: string; ok?: boolean } | undefined;

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
  const emailRaw = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "").trim();

  if (!deptId) return { error: "Department is required." };
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { error: "Enter a valid email address." };
  }

  const [dept] = await db
    .select()
    .from(schema.department)
    .where(and(eq(schema.department.id, deptId), eq(schema.department.churchId, church.id)))
    .limit(1);
  if (!dept) return { error: "Department not found." };

  // Check if an existing staff account is already assigned to this department
  const [existingDeptStaff] = await db
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.churchId, church.id), eq(schema.staff.departmentId, deptId)))
    .limit(1);

  if (existingDeptStaff) {
    if (password) {
      const hashed = await hashPassword(password);
      if (existingDeptStaff.userId) {
        await db
          .update(schema.account)
          .set({ password: hashed, updatedAt: new Date() })
          .where(eq(schema.account.userId, existingDeptStaff.userId));
      }
    }
    if (existingDeptStaff.email !== emailRaw) {
      if (existingDeptStaff.userId) {
        await db
          .update(schema.user)
          .set({ email: emailRaw, updatedAt: new Date() })
          .where(eq(schema.user.id, existingDeptStaff.userId));
      }
      await db
        .update(schema.staff)
        .set({ email: emailRaw })
        .where(eq(schema.staff.id, existingDeptStaff.id));
    }
    revalidatePath("/departments");
    revalidatePath("/staffs");
    return { ok: true };
  }

  // Create new user & staff account for this department
  if (!password) return { error: "Password is required for new department account." };

  const [existingUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, emailRaw))
    .limit(1);
  if (existingUser) return { error: "A user with that email already exists." };

  const hashed = await hashPassword(password);
  const userId = crypto.randomUUID().replace(/-/g, "");
  const accountId = crypto.randomUUID().replace(/-/g, "");
  const now = new Date();

  await db.insert(schema.user).values({
    id: userId,
    name: `${dept.name} Lead`,
    email: emailRaw,
    emailVerified: true,
    passwordChangeRequired: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.account).values({
    id: accountId,
    accountId: userId,
    providerId: "credential",
    userId,
    password: hashed,
    createdAt: now,
    updatedAt: now,
  });

  const [newStaff] = await db
    .insert(schema.staff)
    .values({
      churchId: church.id,
      userId,
      email: emailRaw,
      role: "Department Lead",
      departmentId: dept.id,
      status: "active",
    })
    .returning({ id: schema.staff.id });

  // Assign department_portal module
  await db.insert(schema.staffModule).values({
    churchId: church.id,
    staffId: newStaff.id,
    module: "department_portal",
  });

  logActivity({
    module: "departments",
    actionCode: "department.account.create",
    action: `Created department login account for "${dept.name}" (${emailRaw})`,
    metadata: { departmentId: dept.id, email: emailRaw },
  });

  try {
    const appUrl = await resolveAppUrl();
    await sendStaffWelcomeEmail({
      to: emailRaw,
      name: `${dept.name} Lead`,
      role: "Department Lead",
      churchName: church.name,
      branches: church.name,
      loginUrl: `${appUrl}/login`,
      temporaryPassword: password,
    });
  } catch (emailErr) {
    console.error("Failed to send department lead credentials email:", emailErr);
  }

  revalidatePath("/departments");
  revalidatePath("/staffs");
  return { ok: true };
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
    await db.delete(schema.staffModule).where(eq(schema.staffModule.staffId, existing.id));
    await db.delete(schema.staff).where(eq(schema.staff.id, existing.id));
    if (existing.userId && existing.userId !== church.ownerId) {
      await db.delete(schema.account).where(eq(schema.account.userId, existing.userId));
      await db.delete(schema.user).where(eq(schema.user.id, existing.userId));
    }
  }

  revalidatePath("/departments");
  revalidatePath("/staffs");
}
