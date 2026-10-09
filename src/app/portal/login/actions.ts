"use server";

import { and, eq, ilike, or, like } from "drizzle-orm";
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
      step: "select_account";
      accounts: Array<{
        memberId: string;
        name: string;
        code: string;
        churchName: string;
        churchLogo: string | null;
        branchPrefix: string;
      }>;
      error?: string;
    }
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

/** Step 1: Lookup member by Member ID or registered Phone Number */
export async function lookupMemberId(identifier: string): Promise<LoginState> {
  const cleanInput = identifier.trim();
  if (!cleanInput) {
    return { step: "initial", error: "Please enter your Member ID or phone number." };
  }

  // 1. Try finding by unique Member ID code (case-insensitive)
  let [member] = await db
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
    .where(ilike(schema.member.memberIdCode, cleanInput.toUpperCase()))
    .limit(1);

  // 2. If not found by Member ID, search by phone number
  if (!member) {
    const digits = cleanInput.replace(/\D/g, "");
    if (digits.length >= 8) {
      const coreDigits = digits.slice(-9); // Core national subscriber digits
      const phoneMatches = await db
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
        .where(
          and(
            eq(schema.member.active, true),
            or(
              eq(schema.member.phone, cleanInput),
              eq(schema.member.phone, digits),
              eq(schema.member.phone, `0${coreDigits}`),
              eq(schema.member.phone, `233${coreDigits}`),
              eq(schema.member.phone, `+233${coreDigits}`),
              like(schema.member.phone, `%${coreDigits}%`)
            )
          )
        );

      if (phoneMatches.length === 0) {
        return {
          step: "initial",
          error: "No member found with this Member ID or phone number. Please check and try again.",
        };
      }

      // Check for registered/activated accounts with password
      const registeredAccounts = phoneMatches.filter((m) => m.portalActive && m.passwordHash);

      if (registeredAccounts.length === 0) {
        const firstUnactivated = phoneMatches[0];
        return {
          step: "initial",
          error: `Account found for ${firstUnactivated.fullName}, but first-time activation is required. Please sign in using your Member ID (${firstUnactivated.memberIdCode || "sent via SMS"}) to set your password.`,
        };
      }

      if (registeredAccounts.length === 1) {
        member = registeredAccounts[0];
      } else {
        // Multiple registered accounts with the same phone (e.g. member in both branches)
        const churches = await db.select().from(schema.church);
        const churchMap = new Map(churches.map((c) => [c.id, c]));

        return {
          step: "select_account",
          accounts: registeredAccounts.map((m) => {
            const ch = churchMap.get(m.churchId);
            return {
              memberId: m.id,
              name: m.fullName,
              code: m.memberIdCode || "—",
              churchName: ch?.name || "Church Sanctuary",
              churchLogo: ch?.logoUrl || null,
              branchPrefix: getBranchPrefix(ch?.name),
            };
          }),
        };
      }
    }
  }

  if (!member) {
    return {
      step: "initial",
      error: "Member ID or phone number not recognized. Please check your details or contact your church administrator.",
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
      code: member.memberIdCode || cleanInput,
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
    code: member.memberIdCode || cleanInput,
    churchName: church.name,
    churchLogo: church.logoUrl,
    branchPrefix: getBranchPrefix(church.name),
  };
}

/** When multiple accounts share a phone, member selects which account to login with */
export async function selectMemberForPassword(memberId: string): Promise<LoginState> {
  const [member] = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      passwordHash: schema.member.passwordHash,
      portalActive: schema.member.portalActive,
      memberIdCode: schema.member.memberIdCode,
      active: schema.member.active,
      churchId: schema.member.churchId,
    })
    .from(schema.member)
    .where(eq(schema.member.id, memberId))
    .limit(1);

  if (!member || !member.active) {
    return { step: "initial", error: "Member account not found or inactive." };
  }

  const [church] = await db
    .select()
    .from(schema.church)
    .where(eq(schema.church.id, member.churchId))
    .limit(1);

  return {
    step: "password",
    memberId: member.id,
    name: member.fullName,
    code: member.memberIdCode || "—",
    churchName: church?.name || "Church",
    churchLogo: church?.logoUrl || null,
    branchPrefix: getBranchPrefix(church?.name),
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
