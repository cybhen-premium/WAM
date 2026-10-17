import "server-only";
import { cache } from "react";
import crypto from "crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendSms, withFooter } from "@/lib/sms";
import { resolveAppUrl } from "@/lib/notifications";

export const MEMBER_SESSION_COOKIE = "wam_member_session";

type Church = typeof schema.church.$inferSelect;
type Member = typeof schema.member.$inferSelect;

/** Returns the dedicated short prefix for the church branch (e.g. HSC for Holy Spirit Citadel, WAM for World Ark Missions central) */
export function getBranchPrefix(churchName?: string): string {
  if (!churchName) return "WAM";
  const lower = churchName.toLowerCase();

  // Branch 1: Holy Spirit Citadel
  if (lower.includes("holy spirit")) {
    return "HSC";
  }

  // Branch 2: Salvation Citadel / Central World Ark Missions
  if (lower.includes("salvation") || lower.includes("world ark")) {
    return "WAM";
  }

  // If formatted as "Church - Branch", extract the branch portion
  if (churchName.includes("-")) {
    const parts = churchName.split("-");
    const branchPart = parts[parts.length - 1].trim();
    const branchInitials = branchPart
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (branchInitials.length >= 2 && branchInitials.length <= 4) {
      return branchInitials;
    }
  }

  const initials = churchName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (initials.length >= 2 && initials.length <= 4) {
    return initials;
  }

  return "WAM";
}

/** Generates a human-friendly unique Member ID code scoped by branch, e.g. HSC-8K2P or WAM-3X9M */
export async function generateMemberIdCode(churchName?: string): Promise<string> {
  const prefix = getBranchPrefix(churchName);

  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let attempts = 0;
  while (attempts < 20) {
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(crypto.randomInt(0, chars.length));
    }
    const candidate = `${prefix}-${rand}`;
    const [existing] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.memberIdCode, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
    attempts++;
  }

  // Fallback with timestamp suffix if collisions occur
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}



/** Resolves the public Member Portal login URL with optional prefilled ID */
export async function getPortalUrl(memberCode?: string): Promise<string> {
  const base = await resolveAppUrl();
  return memberCode
    ? `${base}/portal/login?id=${encodeURIComponent(memberCode)}`
    : `${base}/portal/login`;
}

/** Secure password hashing using Node scrypt */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/** Secure timing-safe password verification */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/** Sends a 6-digit OTP to the member via SMS */
export async function sendMemberOtp(
  memberId: string,
  phone: string,
  purpose: "activation" | "reset",
  church: Church
): Promise<{ ok: boolean; error?: string; devOtp?: string }> {
  if (!phone) {
    return { ok: false, error: "Member does not have a registered phone number." };
  }

  // Generate 6-digit numeric OTP
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  // Invalidate any previous unused OTPs for this purpose
  await db
    .update(schema.memberOtp)
    .set({ used: true })
    .where(and(eq(schema.memberOtp.memberId, memberId), eq(schema.memberOtp.purpose, purpose)));

  // Insert new OTP
  await db.insert(schema.memberOtp).values({
    memberId,
    code: otpCode,
    purpose,
    expiresAt,
    used: false,
  });

  const actionText = purpose === "activation" ? "Member Portal activation" : "Password reset";
  const messageBody = withFooter(
    church,
    `Your ${church.name} ${actionText} code is: ${otpCode}. This code expires in 15 minutes. Please do not share it with anyone.`
  );

  const smsRes = await sendSms(church, [phone], messageBody, {
    kind: "portal_otp",
    audience: phone,
    topic: "Member Portal Authentication",
  });

  if (smsRes.status === "failed") {
    // If SMS sending failed due to credentials or telco issue, still return ok in dev or report error
    console.warn(`[MemberPortal] SMS delivery failed: ${smsRes.error}. (Dev OTP: ${otpCode})`);
  }

  return { ok: true, devOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined };
}

/** Validates and consumes a 6-digit OTP */
export async function verifyMemberOtp(
  memberId: string,
  code: string,
  purpose: "activation" | "reset"
): Promise<{ ok: boolean; error?: string }> {
  const cleanCode = code.trim();
  const now = new Date();

  const [otpRow] = await db
    .select()
    .from(schema.memberOtp)
    .where(
      and(
        eq(schema.memberOtp.memberId, memberId),
        eq(schema.memberOtp.code, cleanCode),
        eq(schema.memberOtp.purpose, purpose),
        eq(schema.memberOtp.used, false),
        gt(schema.memberOtp.expiresAt, now)
      )
    )
    .limit(1);

  if (!otpRow) {
    return { ok: false, error: "Invalid or expired 6-digit verification code. Please request a new one." };
  }

  // Mark as used
  await db.update(schema.memberOtp).set({ used: true }).where(eq(schema.memberOtp.id, otpRow.id));

  return { ok: true };
}

/** Creates a member session and sets the cookie */
export async function createMemberSession(memberId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(schema.memberSession).values({
    id: token,
    memberId,
    expiresAt,
  });

  await db.update(schema.member).set({ lastLoginAt: new Date() }).where(eq(schema.member.id, memberId));

  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/** Retrieves the current authenticated member and church (memoized per request) */
export const getMemberSession = cache(async (): Promise<{ member: Member; church: Church } | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();
  const [row] = await db
    .select({
      member: schema.member,
      church: schema.church,
    })
    .from(schema.memberSession)
    .innerJoin(schema.member, eq(schema.member.id, schema.memberSession.memberId))
    .innerJoin(schema.church, eq(schema.church.id, schema.member.churchId))
    .where(
      and(
        eq(schema.memberSession.id, token),
        gt(schema.memberSession.expiresAt, now),
        eq(schema.member.active, true)
      )
    )
    .limit(1);

  if (!row) return null;

  return { member: row.member, church: row.church };
});

/** Destroys the member session and clears the cookie */
export async function destroyMemberSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(schema.memberSession).where(eq(schema.memberSession.id, token)).catch(() => {});
  }
  cookieStore.delete(MEMBER_SESSION_COOKIE);
}
