"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { MODULE_KEYS } from "@/lib/modules";
import { hashPassword } from "better-auth/crypto";
import { logActivity } from "@/lib/activity";

const { staff, staffModule, user, account } = schema;

async function requireAdmin() {
  const ctx = await requireChurch();
  if (ctx.role !== "admin") throw new Error("Only admins can manage staff.");
  return ctx;
}

const DEFAULT_ROLES = ["Admin", "Finance", "SOB", "Akwaaba"] as const;

/** "John Doe" → "johndoe" */
function toUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/* --- Create staff ------------------------------------------------------- */

export type CreateStaffState =
  | { ok: true; staffId: string }
  | { error: string }
  | undefined;

export async function createStaff(
  _prev: CreateStaffState,
  f: FormData,
): Promise<CreateStaffState> {
  await requireModule("staffs");
  const { church: c } = await requireAdmin();

  const name     = String(f.get("name")     ?? "").trim();
  const emailRaw = String(f.get("email")    ?? "").trim().toLowerCase();
  const username = String(f.get("username") ?? "").trim() || toUsername(name);
  const password = String(f.get("password") ?? "").trim() || "WAMCHURCH@26";
  const roleRaw  = String(f.get("role")     ?? "Secretary").trim();
  const role     = roleRaw || "Secretary";
  const activateNow = f.get("activate") === "on";
  const modulesRaw  = f.getAll("modules") as string[];
  const branchIdsRaw = f.getAll("branchIds") as string[];
  const targetBranchIds = branchIdsRaw.length > 0 ? branchIdsRaw : [c.id];

  if (!name)   return { error: "Full name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw))
    return { error: "Enter a valid email address." };

  // Check if user already exists
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, emailRaw))
    .limit(1);

  // Check which of the target branches this user is already in
  const existingStaffRows = await db
    .select({ churchId: staff.churchId })
    .from(staff)
    .where(eq(staff.email, emailRaw));

  const existingChurchIds = new Set(existingStaffRows.map((r) => r.churchId));
  const newChurchIds = targetBranchIds.filter((cid) => !existingChurchIds.has(cid));

  if (newChurchIds.length === 0) {
    return { error: "A staff record with that email already exists in the selected branch(es)." };
  }

  let finalUserId = existingUser?.id;

  if (!finalUserId) {
    // Hash password using Better Auth's own scrypt hasher
    const hashed = await hashPassword(password);
    finalUserId = crypto.randomUUID().replace(/-/g, "");
    const accountId = crypto.randomUUID().replace(/-/g, "");
    const now = new Date();

    await db.insert(user).values({
      id: finalUserId,
      name: username,
      email: emailRaw,
      emailVerified: true,
      passwordChangeRequired: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(account).values({
      id: accountId,
      accountId: finalUserId,
      providerId: "credential",
      userId: finalUserId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });
  }

  let firstNewStaffId = "";

  for (const branchId of newChurchIds) {
    const [newStaff] = await db.insert(staff).values({
      churchId: branchId,
      userId: finalUserId,
      email: emailRaw,
      role,
      status: activateNow ? "active" : "pending",
    }).returning({ id: staff.id });

    if (!firstNewStaffId) firstNewStaffId = newStaff.id;

    // Assign modules (non-admins)
    if (role !== "admin" && modulesRaw.length > 0) {
      const wanted = MODULE_KEYS.filter((k) => modulesRaw.includes(k));
      if (wanted.length > 0) {
        await db.insert(staffModule).values(
          wanted.map((module) => ({ churchId: branchId, staffId: newStaff.id, module })),
        );
      }
    }
  }

  logActivity({
    module: "staffs",
    actionCode: "user.create",
    action: `Created new user ${username || name}`,
    metadata: { staffId: firstNewStaffId, email: emailRaw, role, status: activateNow ? "active" : "pending" },
  });

  revalidatePath("/staffs");
  revalidatePath("/", "layout");
  return { ok: true, staffId: firstNewStaffId };
}

export async function updateStaff(
  _prev: CreateStaffState,
  f: FormData,
): Promise<CreateStaffState> {
  await requireModule("staffs");
  const { church: c } = await requireAdmin();

  const staffId  = String(f.get("staffId"));
  const name     = String(f.get("name")     ?? "").trim();
  const username = String(f.get("username") ?? "").trim() || toUsername(name);
  const emailRaw = String(f.get("email")    ?? "").trim().toLowerCase();
  const roleRaw  = String(f.get("role")     ?? "Secretary").trim();
  const role     = roleRaw || "Secretary";
  const modulesRaw  = f.getAll("modules") as string[];

  if (!name) return { error: "Full name is required." };

  const [existingStaff] = await db.select().from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.churchId, c.id))).limit(1);
  if (!existingStaff) return { error: "Staff not found." };

  if (existingStaff.email !== emailRaw) {
    const [dup] = await db.select().from(user).where(eq(user.email, emailRaw)).limit(1);
    if (dup) return { error: "Another user is using that email." };
  }

  if (existingStaff.userId) {
    await db.update(user).set({ name: username, email: emailRaw, updatedAt: new Date() })
      .where(eq(user.id, existingStaff.userId));
  }
  await db.update(staff).set({ email: emailRaw, role }).where(eq(staff.id, staffId));

  if (role !== "admin") {
    await db.delete(staffModule).where(eq(staffModule.staffId, staffId));
    const wanted = MODULE_KEYS.filter((k) => modulesRaw.includes(k));
    if (wanted.length > 0) {
      await db.insert(staffModule).values(
        wanted.map((module) => ({ churchId: c.id, staffId, module }))
      );
    }
  }
  logActivity({
    module: "staffs",
    action: `Updated staff profile for "${name}"`,
    metadata: { staffId, email: emailRaw, role },
  });

  revalidatePath("/staffs");
  revalidatePath("/", "layout");
  return { ok: true, staffId };
}

/* --- Mutate existing staff ---------------------------------------------- */

export async function changeTwoFactorMethod(staffId: string, method: string) {
  await requireModule("staffs");
  const { church: c } = await requireAdmin();
  if (!["none", "email", "sms", "totp"].includes(method)) return;
  
  await db.update(staff).set({ twoFactorMethod: method })
    .where(and(eq(staff.id, staffId), eq(staff.churchId, c.id)));
  logActivity({
    module: "staffs",
    action: `Changed 2FA method to ${method}`,
    metadata: { staffId, method },
  });
    
  revalidatePath("/staffs");
}

export async function removeStaff(staffId: string) {
  await requireModule("staffs");
  const { church: c, user: me } = await requireAdmin();
  const [row] = await db.select().from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.churchId, c.id))).limit(1);
  if (!row || row.userId === me.id) return;

  // Delete staff row first (FK constraints), then wipe the auth records so the
  // user can no longer log in at all.
  await db.delete(staff).where(eq(staff.id, staffId));

  if (row.userId) {
    await db.delete(account).where(eq(account.userId, row.userId));
    await db.delete(user).where(eq(user.id, row.userId));
  }
  logActivity({
    module: "staffs",
    actionCode: "user.delete.permanent",
    action: `Permanently deleted user ${row.email}`,
    metadata: { staffId, email: row.email, role: row.role },
  });

  revalidatePath("/staffs");
}

export async function updateStaffStatus(staffId: string, status: "active" | "pending" | "suspended") {
  await requireModule("staffs");
  const { church: c, user: me } = await requireAdmin();
  const [row] = await db.select().from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.churchId, c.id))).limit(1);
  if (!row || row.userId === me.id) return;
  
  await db.update(staff).set({ status }).where(eq(staff.id, staffId));
  
  if (status === "suspended") {
    const { sendEmail } = await import("@/lib/auth");
    await sendEmail({
      to: row.email,
      subject: "Your Account Has Been Suspended",
      html: `<p>Hello,</p>
      <p>Your account on <strong>${c.name}</strong> has been suspended by an administrator.</p>
      <p>You will no longer be able to access the system. If you believe this is a mistake, please contact your administrator.</p>
      <br />
      <p>Best regards,<br />${c.name}</p>`,
    });
  } else if (status === "active") {
    // Optional: send an unsuspend email
    const { sendEmail } = await import("@/lib/auth");
    await sendEmail({
      to: row.email,
      subject: "Your Account Has Been Restored",
      html: `<p>Hello,</p>
      <p>Your account on <strong>${c.name}</strong> has been restored by an administrator.</p>
      <p>You can now log in and access the system normally.</p>
      <br />
      <p>Best regards,<br />${c.name}</p>`,
    });
  }
  logActivity({
    module: "staffs",
    actionCode: status === "suspended" ? "user.suspend" : status === "active" ? "user.unsuspend" : "user.status",
    action: status === "suspended" ? `Suspended user ${row.email}` : status === "active" ? `Unsuspended user ${row.email}` : `Changed status to ${status} for ${row.email}`,
    metadata: { staffId, email: row.email, status },
  });

  revalidatePath("/staffs");
}

export async function setStaffModules(staffId: string, modules: string[]) {
  await requireModule("staffs");
  const { church: c } = await requireAdmin();
  const [target] = await db.select({ id: staff.id, role: staff.role }).from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.churchId, c.id))).limit(1);
  if (!target || target.role === "admin") return;

  const wanted = MODULE_KEYS.filter((k) => modules.includes(k));
  await db.delete(staffModule)
    .where(and(eq(staffModule.churchId, c.id), eq(staffModule.staffId, staffId)));
  if (wanted.length) {
    await db.insert(staffModule).values(
      wanted.map((module) => ({ churchId: c.id, staffId, module })),
    );
  }
  logActivity({
    module: "staffs",
    action: "Updated staff module permissions",
    metadata: { staffId, modules: wanted },
  });
  revalidatePath("/staffs");
  revalidatePath("/", "layout");
}
