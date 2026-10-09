"use server";

import { and, eq, ilike } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  hashPassword,
  verifyPassword,
  sendMemberOtp,
  verifyMemberOtp,
  createMemberSession,
  getBranchPrefix,
} from "@/lib/member-portal";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  const start = digits.slice(0, 3);
  const end = digits.slice(-3);
  return `${start} ••• ••• ${end}`;
}

export type LoginState =
  | { step: "initial"; error?: string }
  | {
      step: "password";
      memberId: string;
      name: string;
      code: string;
      churchName: string;
      churchLogo: string | null;
      branchPrefix: string;
      error?: string;
    }
  | {
      step: "activate";
      memberId: string;
      name: string;
      code: string;
      phoneMasked: string;
      churchName: string;
      churchLogo: string | null;
      branchPrefix: string;
      devOtp?: string;
      error?: string;
    }
  | {
      step: "reset";
      memberId: string;
      name: string;
      phoneMasked: string;
      devOtp?: string;
      error?: string;
    };

/** Step 1: Lookup member by unique Member ID code */
export async function lookupMemberId(code: string): Promise<LoginState> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { step: "initial", error: "Please enter your Member ID." };
  }

  const [member] = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      passwordHash: schema.member.passwordHash,
      portalActive: schema.member.portalActive,
      memberIdCode: schema.member.memberIdCode,
      active: schema.member.active,
      churchId: schema.member.churchId,
    })
    .from(schema.member)
    .where(ilike(schema.member.memberIdCode, cleanCode))
    .limit(1);

  if (!member) {
    return {
      step: "initial",
      error: "Member ID not recognized. Please check your code or contact your church administrator.",
    };
  }

  if (!member.active) {
    return {
      step: "initial",
      error: "This member account is currently inactive. Please speak with your church administration.",
    };
  }

  const [church] = await db
    .select()
    .from(schema.church)
    .where(eq(schema.church.id, member.churchId))
    .limit(1);

  if (!church) {
    return { step: "initial", error: "Church organization not found." };
  }

  // If the member has never set a password, initiate activation with SMS OTP
  if (!member.passwordHash || !member.portalActive) {
    if (!member.phone) {
      return {
        step: "initial",
        error: "No phone number is registered for this Member ID. Please contact church administration to update your phone number.",
      };
    }

    const otpRes = await sendMemberOtp(member.id, member.phone, "activation", church);
    if (!otpRes.ok) {
      return { step: "initial", error: otpRes.error || "Failed to send activation code via SMS." };
    }

    return {
      step: "activate",
      memberId: member.id,
      name: member.fullName,
      code: cleanCode,
      phoneMasked: maskPhone(member.phone),
      churchName: church.name,
      churchLogo: church.logoUrl,
      branchPrefix: getBranchPrefix(church.name),
      devOtp: otpRes.devOtp,
    };
  }

  // Member has an existing password -> prompt for password
  return {
    step: "password",
    memberId: member.id,
    name: member.fullName,
    code: cleanCode,
    churchName: church.name,
    churchLogo: church.logoUrl,
    branchPrefix: getBranchPrefix(church.name),
  };
}

/** Step 2A: Set password and activate portal account using OTP */
export async function activateMemberAccount(
  memberId: string,
  otpCode: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters long." };
  }

  const verifyRes = await verifyMemberOtp(memberId, otpCode, "activation");
  if (!verifyRes.ok) {
    return { ok: false, error: verifyRes.error };
  }

  const hash = hashPassword(password);
  await db
    .update(schema.member)
    .set({
      passwordHash: hash,
      portalActive: true,
      lastLoginAt: new Date(),
    })
    .where(eq(schema.member.id, memberId));

  await createMemberSession(memberId);
  return { ok: true };
}

/** Step 2B: Login using established password */
export async function loginMember(
  memberId: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  if (!password) {
    return { ok: false, error: "Password is required." };
  }

  const [member] = await db
    .select({
      id: schema.member.id,
      passwordHash: schema.member.passwordHash,
      active: schema.member.active,
    })
    .from(schema.member)
    .where(eq(schema.member.id, memberId))
    .limit(1);

  if (!member || !member.active) {
    return { ok: false, error: "Invalid credentials or inactive account." };
  }

  if (!member.passwordHash || !verifyPassword(password, member.passwordHash)) {
    return { ok: false, error: "Incorrect password. Please try again or reset your password." };
  }

  await createMemberSession(member.id);
  return { ok: true };
}

/** Request password reset OTP */
export async function requestPasswordReset(memberId: string): Promise<LoginState> {
  const [member] = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      churchId: schema.member.churchId,
    })
    .from(schema.member)
    .where(eq(schema.member.id, memberId))
    .limit(1);

  if (!member || !member.phone) {
    return { step: "initial", error: "Could not locate member phone number for reset." };
  }

  const [church] = await db
    .select()
    .from(schema.church)
    .where(eq(schema.church.id, member.churchId))
    .limit(1);

  if (!church) {
    return { step: "initial", error: "Church record not found." };
  }

  const otpRes = await sendMemberOtp(member.id, member.phone, "reset", church);
  if (!otpRes.ok) {
    return { step: "initial", error: otpRes.error || "Failed to send reset code via SMS." };
  }

  return {
    step: "reset",
    memberId: member.id,
    name: member.fullName,
    phoneMasked: maskPhone(member.phone),
    devOtp: otpRes.devOtp,
  };
}

/** Complete password reset */
export async function completePasswordReset(
  memberId: string,
  otpCode: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters long." };
  }

  const verifyRes = await verifyMemberOtp(memberId, otpCode, "reset");
  if (!verifyRes.ok) {
    return { ok: false, error: verifyRes.error };
  }

  const hash = hashPassword(newPassword);
  await db
    .update(schema.member)
    .set({
      passwordHash: hash,
      portalActive: true,
      lastLoginAt: new Date(),
    })
    .where(eq(schema.member.id, memberId));

  await createMemberSession(memberId);
  return { ok: true };
}
