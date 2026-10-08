"use server";

import { requireUser, getChurchForUser, getUserBranches } from "@/lib/session";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { landingHref, moduleForPath, getMyPermissions } from "@/lib/permissions";

/**
 * Resolves a login input that could be either an email or a username.
 * If an email (contains @), returns normalized lowercase email.
 * If a username, looks up the user by name (case-insensitive) and returns their email.
 */
export async function resolveLoginEmail(identifier: string): Promise<string> {
  const trimmed = (identifier ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  // Look up by username in user table
  const users = await db
    .select({ email: schema.user.email, name: schema.user.name })
    .from(schema.user);

  const matched = users.find(
    (u) => (u.name ?? "").toLowerCase() === trimmed.toLowerCase(),
  );

  return matched?.email ? matched.email.toLowerCase() : trimmed.toLowerCase();
}

export async function checkLoginStatus(targetNext?: string) {
  try {
    const user = await requireUser();
    let status = "error";
    
    // Check all staff records for this user across branches
    const staffRows = await db
      .select({
        status: schema.staff.status,
        twoFactorMethod: schema.staff.twoFactorMethod,
      })
      .from(schema.staff)
      .where(eq(schema.staff.userId, user.id));

    let ownerTwoFactorMethod: string | null = null;

    if (staffRows.length > 0) {
      if (staffRows.some((r) => r.status === "active")) {
        status = "active";
      } else if (staffRows.some((r) => r.status === "pending")) {
        status = "pending";
      } else {
        status = staffRows[0].status;
      }

      if (status === "active") {
        const row = await getChurchForUser(user.id);
        if (row) {
          logActivity({
            churchId: row.church.id,
            userId: user.id,
            actorName: user.name || "Staff Member",
            actorEmail: user.email,
            module: "auth",
            actionCode: "auth.login",
            action: "Staff member logged in successfully",
          });
        }
      }
    } else {
      const row = await getChurchForUser(user.id);
      if (row) {
        status = "active";
        // For the super admin (church owner), check the church-level 2FA setting
        ownerTwoFactorMethod = row.church.ownerTwoFactorMethod ?? "none";
        logActivity({
          churchId: row.church.id,
          userId: user.id,
          actorName: user.name || "Super Administrator",
          actorEmail: user.email,
          module: "auth",
          actionCode: "auth.login",
          action: "User logged in successfully",
        });
      } else {
        status = "deleted";
      }
    }

    const activeStaffRow = staffRows.find((r) => r.status === "active") ?? staffRows[0];
    const missingTwoFactorSetup =
      (activeStaffRow && activeStaffRow.twoFactorMethod !== "none" && !user.twoFactorEnabled) ||
      (ownerTwoFactorMethod !== null && ownerTwoFactorMethod !== "none" && !user.twoFactorEnabled);

    // Fetch accessible branches for this user
    const branches = await getUserBranches(user.id);

    // Compute safe redirect target based on user's authorized modules
    const landing = await landingHref();
    let resolvedNext = landing;
    if (
      targetNext &&
      targetNext.startsWith("/") &&
      !targetNext.startsWith("//") &&
      targetNext !== "/login"
    ) {
      const gate = moduleForPath(targetNext);
      const perms = await getMyPermissions();
      if (!gate || perms === "all" || perms.has(gate)) {
        resolvedNext = targetNext;
      }
    }

    return {
      status,
      passwordChangeRequired: Boolean((user as any)?.passwordChangeRequired),
      missingTwoFactorSetup,
      resolvedNext,
      branches: branches.map((b) => ({
        id: b.church.id,
        name: b.church.name,
        role: b.role,
      })),
    };
  } catch (err) {
    console.error("[Login] checkLoginStatus error:", err);
    return {
      status: "error",
      passwordChangeRequired: false,
      missingTwoFactorSetup: false,
      resolvedNext: "/",
      branches: [],
    };
  }
}

export async function selectBranchForSession(branchId: string) {
  const user = await requireUser();
  const branches = await getUserBranches(user.id);
  const match = branches.find((b) => b.church.id === branchId);
  if (!match) {
    return { ok: false, error: "You do not have access to this branch." };
  }

  const cookieStore = await cookies();
  cookieStore.set("active_branch_id", branchId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    httpOnly: false,
  });

  return { ok: true, branchId, branchName: match.church.name };
}

export async function forcePasswordChange(password: string) {
  const user = await requireUser();
  const requestHeaders = await headers();
  
  const hashed = await hashPassword(password);
  await db.update(schema.account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(schema.account.userId, user.id));
  
  await db.update(schema.user)
    .set({ passwordChangeRequired: false, updatedAt: new Date() })
    .where(eq(schema.user.id, user.id));

  try {
    await auth.api.updateUser({
      headers: requestHeaders,
      body: {
        passwordChangeRequired: false
      }
    });
  } catch (err) {
    console.warn("[ForcePasswordChange] auth.api.updateUser warning:", err);
  }

  const row = await getChurchForUser(user.id);
  if (row) {
    logActivity({
      churchId: row.church.id,
      userId: user.id,
      actorName: user.name || "User",
      actorEmail: user.email,
      module: "auth",
      actionCode: "auth.password",
      action: "Changed user password",
    });
  }
}

export async function getTwoFactorMethodByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return "email";

  // Check staff table first
  const [staffRow] = await db
    .select({ method: schema.staff.twoFactorMethod, userId: schema.user.id })
    .from(schema.staff)
    .innerJoin(schema.user, eq(schema.user.id, schema.staff.userId))
    .where(eq(schema.user.email, normalizedEmail))
    .limit(1);

  if (staffRow) {
    if (staffRow.method === "none") {
      // Clear orphaned 2FA flag on user so subsequent logins do not prompt for 2FA
      await db.update(schema.user).set({ twoFactorEnabled: false }).where(eq(schema.user.id, staffRow.userId));
      return "none";
    }
    return staffRow.method || "totp";
  }

  // Fall back to church owner (super admin)
  const [churchRow] = await db
    .select({ method: schema.church.ownerTwoFactorMethod })
    .from(schema.church)
    .innerJoin(schema.user, eq(schema.user.id, schema.church.ownerId))
    .where(eq(schema.user.email, normalizedEmail))
    .limit(1);
  return churchRow?.method || "email";
}

/**
 * Check a user's account status by email — no session needed.
 * Used to block deleted/suspended/pending accounts before the 2FA redirect or password reset.
 * Returns null if the email is not found.
 */
export async function checkStatusByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  // Look up the user row by email
  const [userRow] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, normalizedEmail))
    .limit(1);

  if (!userRow) return null;

  // Check staff table across all branches
  const staffRows = await db
    .select({ status: schema.staff.status })
    .from(schema.staff)
    .where(eq(schema.staff.userId, userRow.id));

  if (staffRows.length > 0) {
    if (staffRows.some((r) => r.status === "active")) return "active";
    if (staffRows.some((r) => r.status === "pending")) return "pending";
    return staffRows[0].status;
  }

  // Fall back to church ownership check
  const [churchOwner] = await db
    .select({ id: schema.church.id })
    .from(schema.church)
    .where(eq(schema.church.ownerId, userRow.id))
    .limit(1);

  return churchOwner ? "active" : "deleted";
}

