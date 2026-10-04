"use server";

import { requireUser, getChurchForUser } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function checkLoginStatus() {
  try {
    const user = await requireUser();
    let status = "error";
    
    // First, check staff table
    const [staffRow] = await db
      .select({ status: schema.staff.status, twoFactorMethod: schema.staff.twoFactorMethod })
      .from(schema.staff)
      .where(eq(schema.staff.userId, user.id))
      .limit(1);

    let ownerTwoFactorMethod: string | null = null;

    if (staffRow) {
      status = staffRow.status;
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

    const missingTwoFactorSetup =
      (staffRow && staffRow.twoFactorMethod !== "none" && !user.twoFactorEnabled) ||
      (ownerTwoFactorMethod !== null && ownerTwoFactorMethod !== "none" && !user.twoFactorEnabled);

    return { status, missingTwoFactorSetup };
  } catch {
    return { status: "error", missingTwoFactorSetup: false };
  }
}

export async function forcePasswordChange(password: string) {
  const user = await requireUser();
  const requestHeaders = await headers();
  
  const hashed = await hashPassword(password);
  await db.update(schema.account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(schema.account.userId, user.id));
  
  await auth.api.updateUser({
    headers: requestHeaders,
    body: {
      passwordChangeRequired: false
    }
  });

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
    .select({ method: schema.staff.twoFactorMethod })
    .from(schema.staff)
    .innerJoin(schema.user, eq(schema.user.id, schema.staff.userId))
    .where(eq(schema.user.email, normalizedEmail))
    .limit(1);
  if (staffRow) return staffRow.method || "totp";

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

  // Check staff table first
  const [staffRow] = await db
    .select({ status: schema.staff.status })
    .from(schema.staff)
    .where(eq(schema.staff.userId, userRow.id))
    .limit(1);

  if (staffRow) return staffRow.status;

  // Fall back to church ownership check
  const [churchOwner] = await db
    .select({ id: schema.church.id })
    .from(schema.church)
    .where(eq(schema.church.ownerId, userRow.id))
    .limit(1);

  return churchOwner ? "active" : "deleted";
}

