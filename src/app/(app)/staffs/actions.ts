"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule, isBranchWithDisabledAdmin } from "@/lib/permissions";
import { MODULE_KEYS } from "@/lib/modules";
import { hashPassword } from "better-auth/crypto";
import { logActivity } from "@/lib/activity";
import { resolveAppUrl } from "@/lib/notifications";
import { sendStaffWelcomeEmail } from "@/lib/email";

const { staff, staffModule, user, account } = schema;

async function requireAdmin() {
  const ctx = await requireChurch();
  if (ctx.role !== "admin") throw new Error("Only admins can manage staff.");
  if (isBranchWithDisabledAdmin(ctx.church.name)) {
    throw new Error("Staff management is handled exclusively from the Salvation Citadel headquarters.");
  }
  return ctx;
}

const DEFAULT_ROLES = ["Admin", "Finance", "SOB", "Akwaaba"] as const;

/** "John Doe" → "johndoe" */
function toUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/* --- Create staff ------------------------------------------------------- */

export type CreateStaffState =
  | { ok: true; staffId: string; emailSent?: boolean; message?: string }
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

  if (!name) return { error: "Full name is required." };

  const emails = emailRaw
    .split(/[,;\n\r]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) return { error: "Enter a valid email address." };

  const invalidEmails = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (invalidEmails.length > 0) {
    return { error: `Invalid email address format: ${invalidEmails.join(", ")}` };
  }

  // Fetch branch sanctuary names for the welcome email
  const branchRows = await db
    .select({ id: schema.church.id, name: schema.church.name })
    .from(schema.church)
    .where(inArray(schema.church.id, targetBranchIds));
  const branchNames =
    branchRows.map((b) => b.name.replace("World Ark Missions - ", "")).join(", ") || c.name;

  const appUrl = await resolveAppUrl();
  const loginUrl = `${appUrl}/login`;
  const hashed = await hashPassword(password);
  const now = new Date();

  let firstNewStaffId = "";
  let createdCount = 0;
  const sentEmails: string[] = [];
  const failedEmails: string[] = [];

  for (const emailItem of emails) {
    // Check if user already exists
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, emailItem))
      .limit(1);

    // Check which of the target branches this user is already in
    const existingStaffRows = await db
      .select({ churchId: staff.churchId })
      .from(staff)
      .where(eq(staff.email, emailItem));

    const existingChurchIds = new Set(existingStaffRows.map((r) => r.churchId));
    const newChurchIds = targetBranchIds.filter((cid) => !existingChurchIds.has(cid));

    if (newChurchIds.length === 0) {
      if (emails.length === 1) {
        return { error: "A staff record with that email already exists in the selected branch(es)." };
      }
      continue;
    }

    let finalUserId = existingUser?.id;
    const currentUsername = emails.length === 1 ? username : toUsername(emailItem.split("@")[0]);
    const currentName = emails.length === 1 ? name : (name ? `${name} (${emailItem.split("@")[0]})` : emailItem.split("@")[0]);

    if (!finalUserId) {
      finalUserId = crypto.randomUUID().replace(/-/g, "");
      const accountId = crypto.randomUUID().replace(/-/g, "");

      await db.insert(user).values({
        id: finalUserId,
        name: currentUsername,
        email: emailItem,
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
    } else {
      // Prevent modifying church owner credentials through staff creation
      if (finalUserId === c.ownerId) {
        if (emails.length === 1) {
          return { error: "The church owner account cannot be modified via staff creation." };
        }
        continue;
      }

      // Existing user: ensure they have a credential account record
      const [existingAccount] = await db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, finalUserId), eq(account.providerId, "credential")))
        .limit(1);

      if (!existingAccount) {
        const accountId = crypto.randomUUID().replace(/-/g, "");
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
    }

    let currentStaffId = "";

    for (const branchId of newChurchIds) {
      const [newStaff] = await db.insert(staff).values({
        churchId: branchId,
        userId: finalUserId,
        email: emailItem,
        role,
        status: activateNow ? "active" : "pending",
      }).returning({ id: staff.id });

      if (!firstNewStaffId) firstNewStaffId = newStaff.id;
      if (!currentStaffId) currentStaffId = newStaff.id;

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
      action: `Created new user ${currentUsername || currentName}`,
      metadata: { staffId: currentStaffId, email: emailItem, role, status: activateNow ? "active" : "pending" },
    });

    createdCount++;

    // Send credentials email containing the login URL and the default password
    try {
      await sendStaffWelcomeEmail({
        to: emailItem,
        name: currentName,
        username: currentUsername,
        role,
        churchName: c.name,
        branches: branchNames,
        loginUrl,
        temporaryPassword: password,
      });
      sentEmails.push(emailItem);
    } catch (emailErr) {
      console.error(`Failed to send credentials email to ${emailItem}:`, emailErr);
      failedEmails.push(emailItem);
    }
  }

  if (createdCount === 0) {
    return { error: "No new staff could be created (staff already exist in all selected branches)." };
  }

  revalidatePath("/staffs");
  revalidatePath("/", "layout");

  let msg = `Staff created successfully.`;
  if (sentEmails.length > 0) {
    msg += ` Login URL and default password sent to ${sentEmails.join(", ")}.`;
  }
  if (failedEmails.length > 0) {
    msg += ` (Notice: Credentials email could not be delivered to ${failedEmails.join(", ")}).`;
  }

  return {
    ok: true,
    staffId: firstNewStaffId,
    emailSent: sentEmails.length > 0,
    message: msg,
  };
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

  if (existingStaff.userId === c.ownerId && role !== "admin") {
    return { error: "The church owner must remain an Administrator." };
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

  // Sync branch assignments if provided
  const branchIdsRaw = f.getAll("branchIds") as string[];
  if (branchIdsRaw.length > 0 && existingStaff.userId) {
    const targetBranches = new Set(branchIdsRaw);
    const currentRows = await db
      .select({ id: staff.id, churchId: staff.churchId })
      .from(staff)
      .where(eq(staff.userId, existingStaff.userId));
    const currentBranchIds = new Set(currentRows.map((r) => r.churchId));

    // Remove from unselected branches
    for (const row of currentRows) {
      if (!targetBranches.has(row.churchId)) {
        await db.delete(staffModule).where(eq(staffModule.staffId, row.id));
        await db.delete(staff).where(eq(staff.id, row.id));
      }
    }

    // Add to newly selected branches
    for (const bId of targetBranches) {
      if (!currentBranchIds.has(bId)) {
        const [inserted] = await db
          .insert(staff)
          .values({
            churchId: bId,
            userId: existingStaff.userId,
            email: emailRaw,
            role,
            status: existingStaff.status,
            twoFactorMethod: existingStaff.twoFactorMethod,
          })
          .returning({ id: staff.id });

        if (role !== "admin" && modulesRaw.length > 0) {
          const wanted = MODULE_KEYS.filter((k) => modulesRaw.includes(k));
          if (wanted.length > 0) {
            await db.insert(staffModule).values(
              wanted.map((module) => ({ churchId: bId, staffId: inserted.id, module })),
            );
          }
        }
      }
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
  await requireAdmin();
  if (!["none", "email", "sms", "totp", "auth_app"].includes(method)) {
    return { ok: false, error: "Invalid 2FA method." };
  }
  const canonicalMethod = method === "auth_app" ? "totp" : method;

  const [targetStaff] = await db
    .select({ id: staff.id, userId: staff.userId, email: staff.email })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);

  if (!targetStaff) return { ok: false, error: "Staff member not found." };

  if (targetStaff.userId) {
    await db
      .update(staff)
      .set({ twoFactorMethod: canonicalMethod })
      .where(eq(staff.userId, targetStaff.userId));
  } else {
    await db
      .update(staff)
      .set({ twoFactorMethod: canonicalMethod })
      .where(eq(staff.email, targetStaff.email));
  }

  logActivity({
    module: "staffs",
    action: `Changed 2FA method to ${canonicalMethod}`,
    metadata: { staffId, method: canonicalMethod },
  });

  revalidatePath("/staffs");
  return { ok: true, method: canonicalMethod };
}

export async function removeStaff(staffId: string) {
  await requireModule("staffs");
  const { church: c, user: me } = await requireAdmin();
  const [row] = await db.select().from(staff)
    .where(eq(staff.id, staffId)).limit(1);
  if (!row || row.userId === me.id || row.userId === c.ownerId) return;

  // Delete staff row first (FK constraints), then wipe the auth records so the
  // user can no longer log in at all.
  if (row.userId) {
    const userStaffRows = await db.select({ id: staff.id }).from(staff).where(eq(staff.userId, row.userId));
    for (const sRow of userStaffRows) {
      await db.delete(staffModule).where(eq(staffModule.staffId, sRow.id));
    }
    await db.delete(staff).where(eq(staff.userId, row.userId));
    await db.delete(account).where(eq(account.userId, row.userId));
    await db.delete(user).where(eq(user.id, row.userId));
  } else {
    await db.delete(staffModule).where(eq(staffModule.staffId, staffId));
    await db.delete(staff).where(eq(staff.email, row.email));
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
    .where(eq(staff.id, staffId)).limit(1);
  if (!row || row.userId === me.id || row.userId === c.ownerId) return;
  
  if (row.userId) {
    await db.update(staff).set({ status }).where(eq(staff.userId, row.userId));
  } else {
    await db.update(staff).set({ status }).where(eq(staff.email, row.email));
  }
  
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
  await requireAdmin();
  const [target] = await db
    .select({ id: staff.id, role: staff.role, churchId: staff.churchId, userId: staff.userId, email: staff.email })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);
  if (!target || target.role === "admin") return;

  const wanted = MODULE_KEYS.filter((k) => modules.includes(k));

  // Find all branch staff rows for this user or email
  const staffRows = target.userId
    ? await db.select({ id: staff.id, churchId: staff.churchId }).from(staff).where(eq(staff.userId, target.userId))
    : await db.select({ id: staff.id, churchId: staff.churchId }).from(staff).where(eq(staff.email, target.email));

  for (const s of staffRows) {
    await db.delete(staffModule).where(eq(staffModule.staffId, s.id));
    if (wanted.length) {
      await db.insert(staffModule).values(
        wanted.map((module) => ({ churchId: s.churchId, staffId: s.id, module })),
      );
    }
  }

  logActivity({
    module: "staffs",
    action: "Updated staff module permissions",
    metadata: { staffId, modules: wanted },
  });
  revalidatePath("/staffs");
  revalidatePath("/", "layout");
}

export async function resetStaffPassword(staffId: string, customPassword?: string) {
  await requireModule("staffs");
  const { church: c } = await requireAdmin();

  const [targetStaff] = await db
    .select({
      id: staff.id,
      email: staff.email,
      userId: staff.userId,
    })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);

  if (!targetStaff) {
    return { ok: false, error: "Staff member not found." };
  }

  if (targetStaff.userId === c.ownerId) {
    return { ok: false, error: "The church owner's password cannot be reset from staff management." };
  }

  const temporaryPassword = (customPassword ?? "").trim() || "WAMCHURCH@26";
  const hashed = await hashPassword(temporaryPassword);
  const now = new Date();

  let targetUserId = targetStaff.userId;

  if (!targetUserId) {
    const [existingU] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, targetStaff.email))
      .limit(1);

    if (existingU) {
      targetUserId = existingU.id;
    } else {
      targetUserId = crypto.randomUUID().replace(/-/g, "");
      await db.insert(user).values({
        id: targetUserId,
        name: toUsername(targetStaff.email.split("@")[0]),
        email: targetStaff.email,
        emailVerified: true,
        passwordChangeRequired: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.update(staff).set({ userId: targetUserId }).where(eq(staff.id, targetStaff.id));
  } else {
    await db.update(user).set({
      passwordChangeRequired: true,
      updatedAt: now,
    }).where(eq(user.id, targetUserId));
  }

  const [existingAcc] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, targetUserId), eq(account.providerId, "credential")))
    .limit(1);

  if (existingAcc) {
    await db.update(account).set({
      password: hashed,
      updatedAt: now,
    }).where(eq(account.id, existingAcc.id));
  } else {
    const accountId = crypto.randomUUID().replace(/-/g, "");
    await db.insert(account).values({
      id: accountId,
      accountId: targetUserId,
      providerId: "credential",
      userId: targetUserId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });
  }

  logActivity({
    module: "staffs",
    actionCode: "user.password.reset",
    action: `Reset temporary password for ${targetStaff.email}`,
    metadata: { staffId: targetStaff.id, email: targetStaff.email },
  });

  const appUrl = await resolveAppUrl();
  const loginUrl = `${appUrl}/login`;
  let emailSent = false;

  try {
    await sendStaffWelcomeEmail({
      to: targetStaff.email,
      name: targetStaff.email.split("@")[0],
      role: "Staff",
      churchName: c.name,
      loginUrl,
      temporaryPassword,
      isReset: true,
    });
    emailSent = true;
  } catch (err) {
    console.error("Failed to send reset password email:", err);
  }

  revalidatePath("/staffs");
  return { ok: true, password: temporaryPassword, emailSent };
}

export async function resendStaffCredentials(staffId: string) {
  await requireModule("staffs");
  const { church: c } = await requireAdmin();

  const [targetStaff] = await db
    .select({
      id: staff.id,
      email: staff.email,
      role: staff.role,
      userId: staff.userId,
    })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);

  if (!targetStaff) {
    return { ok: false, error: "Staff member not found." };
  }

  const [targetUser] = targetStaff.userId
    ? await db.select({ name: user.name }).from(user).where(eq(user.id, targetStaff.userId)).limit(1)
    : [];

  const appUrl = await resolveAppUrl();
  const loginUrl = `${appUrl}/login`;
  const defaultPassword = "WAMCHURCH@26";

  try {
    await sendStaffWelcomeEmail({
      to: targetStaff.email,
      name: targetUser?.name || targetStaff.email.split("@")[0],
      role: targetStaff.role,
      churchName: c.name,
      loginUrl,
      temporaryPassword: defaultPassword,
    });
    return { ok: true, message: `Login URL & default password sent to ${targetStaff.email}.` };
  } catch (err: any) {
    console.error("Failed to resend credentials:", err);
    return { ok: false, error: err?.message || "Failed to send credentials email." };
  }
}

