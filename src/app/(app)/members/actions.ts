"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { MEMBER_CATEGORIES } from "@/lib/constants";
import { sendSms, withFooter } from "@/lib/sms";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { generateMemberIdCode, getPortalUrl } from "@/lib/member-portal";

const VISITOR = "Visitor";
const REGULAR_ATTENDEE = "Regular Attendee";

const { member } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

export type DuplicateMatch = {
  type: "phone" | "name" | "email";
  member: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    memberIdCode: string | null;
    category: string;
  };
  message: string;
};

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const getNameTokens = (s: string) => normalizeName(s).split(" ").filter(Boolean).sort().join(" ");

/** Look up whether a member with the same phone, name, or email already exists in this church branch */
export async function findDuplicateMember({
  churchId,
  fullName,
  phone,
  email,
  excludeId,
}: {
  churchId: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  excludeId?: string | null;
}): Promise<DuplicateMatch | null> {
  const existingMembers = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      email: schema.member.email,
      memberIdCode: schema.member.memberIdCode,
      category: schema.member.category,
      active: schema.member.active,
    })
    .from(schema.member)
    .where(
      excludeId
        ? and(eq(schema.member.churchId, churchId), ne(schema.member.id, excludeId))
        : eq(schema.member.churchId, churchId)
    );

  const cleanName = normalizeName(fullName);
  const nameTokens = getNameTokens(fullName);
  const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
  const phoneCore = phoneDigits.length >= 8 ? phoneDigits.slice(-9) : "";
  const cleanEmail = email ? email.trim().toLowerCase() : "";

  for (const m of existingMembers) {
    const mCleanName = normalizeName(m.fullName ?? "");
    const mNameTokens = getNameTokens(m.fullName ?? "");
    const mDigits = m.phone ? m.phone.replace(/\D/g, "") : "";
    const mCore = mDigits.length >= 8 ? mDigits.slice(-9) : "";

    const nameMatches = Boolean(
      cleanName &&
      cleanName.length >= 2 &&
      (mCleanName === cleanName || (nameTokens && nameTokens.length >= 3 && mNameTokens === nameTokens))
    );
    const phoneMatches = Boolean(phoneCore && mCore && (mCore === phoneCore || mDigits === phoneDigits));
    const emailMatches = Boolean(cleanEmail && m.email && m.email.trim().toLowerCase() === cleanEmail);

    // If both name and phone collide
    if (nameMatches && phoneMatches) {
      return {
        type: "name",
        member: m,
        message: `A member named "${m.fullName}" with phone number "${phone}" already exists in this church branch (${m.memberIdCode ? `Member ID: ${m.memberIdCode}` : m.category}).`,
      };
    }

    // Name collision
    if (nameMatches) {
      const isTransposed = mCleanName !== cleanName && mNameTokens === nameTokens;
      return {
        type: "name",
        member: m,
        message: isTransposed
          ? `A member named "${m.fullName}" (same name in different word order) already exists in this church branch (${m.memberIdCode ? `Member ID: ${m.memberIdCode}` : m.category}${m.phone ? `, Phone: ${m.phone}` : ""}).`
          : `A member named "${m.fullName}" already exists in this church branch (${m.memberIdCode ? `Member ID: ${m.memberIdCode}` : m.category}${m.phone ? `, Phone: ${m.phone}` : ""}).`,
      };
    }

    // Phone collision
    if (phoneMatches) {
      return {
        type: "phone",
        member: m,
        message: `A member with phone number "${phone}" already exists in this church branch: ${m.fullName} (${m.memberIdCode ? `Member ID: ${m.memberIdCode}` : m.category}).`,
      };
    }

    // Email collision
    if (emailMatches) {
      return {
        type: "email",
        member: m,
        message: `A member with email "${m.email}" already exists in this church branch: ${m.fullName} (${m.memberIdCode ? `Member ID: ${m.memberIdCode}` : m.category}).`,
      };
    }
  }

  return null;
}

/** Server action for real-time duplicate checking from the frontend modal */
export async function checkMemberDuplicate(data: {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  excludeId?: string | null;
}): Promise<{ duplicate: boolean; message?: string } | null> {
  try {
    await requireModule("members");
    const { church } = await requireChurch();
    const hasName = data.fullName.trim().length >= 2;
    const hasPhone = Boolean(data.phone?.trim());
    if (!hasName && !hasPhone) {
      return { duplicate: false };
    }
    const dup = await findDuplicateMember({
      churchId: church.id,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      excludeId: data.excludeId,
    });
    if (dup) {
      return { duplicate: true, message: dup.message };
    }
    return { duplicate: false };
  } catch {
    return null;
  }
}

function readMember(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const opt = (k: string) => s(k) || null;
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s(k)) ? s(k) : null);
  const category = s("category");
  const gender = s("gender").toLowerCase();

  return {
    fullName: s("fullName"),
    photoUrl: opt("photoUrl"),
    phone: opt("phone"),
    email: opt("email"),
    gender: gender === "male" || gender === "female" ? gender : null,
    category: (MEMBER_CATEGORIES as readonly string[]).includes(category) ? category : "General Member",
    baptized: s("baptized") === "Baptized",
    maritalStatus: opt("maritalStatus"),
    occupation: opt("occupation"),
    skills: opt("skills"),
    departmentId: opt("departmentId"),
    address: opt("address"),
    emergencyContactName: opt("emergencyContactName"),
    emergencyContactPhone: opt("emergencyContactPhone"),
    dateOfBirth: date("dateOfBirth"),
    weddingAnniversary: date("weddingAnniversary"),
  } as const;
}

export async function saveMember(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("members");
  const { church } = await requireChurch();
  const values = readMember(form);
  if (!values.fullName) return { error: "Full name is required." };

  const id = String(form.get("id") ?? "");

  // Duplicate Check against existing records in this church branch
  const duplicate = await findDuplicateMember({
    churchId: church.id,
    fullName: values.fullName,
    phone: values.phone,
    email: values.email,
    excludeId: id || undefined,
  });

  if (duplicate) {
    return {
      error: id
        ? duplicate.message
        : `${duplicate.message} Please edit their existing record instead of adding a duplicate.`,
    };
  }

  if (id) {
    const [before] = await db
      .select({ category: member.category })
      .from(member)
      .where(and(eq(member.id, id), eq(member.churchId, church.id)))
      .limit(1);
    if (!before) return { error: "Member not found." };

    // Prevent conversion to full member categories without completing SOB
    if ((before.category === VISITOR || before.category === REGULAR_ATTENDEE) &&
      (values.category !== VISITOR && values.category !== REGULAR_ATTENDEE)) {
      const sobCompleted = await db
        .select({ lesson: schema.sobProgress.lesson })
        .from(schema.sobProgress)
        .where(eq(schema.sobProgress.memberId, id));

      const churchLessons = await db
        .select({ lessonNumber: schema.sobLesson.lessonNumber })
        .from(schema.sobLesson)
        .where(eq(schema.sobLesson.churchId, church.id));

      const requiredNumbers = churchLessons.length > 0
        ? churchLessons.map((l) => l.lessonNumber)
        : [1, 2, 3, 4];

      const sobLessons = new Set(sobCompleted.map((r) => r.lesson));
      const sobDone = requiredNumbers.every((l) => sobLessons.has(l));

      if (!sobDone) {
        return { error: "Member must complete all SOB lessons before becoming a full member." };
      }
    }

    const converted = (before.category === VISITOR || before.category === REGULAR_ATTENDEE) &&
      (values.category !== VISITOR && values.category !== REGULAR_ATTENDEE);
    await db
      .update(member)
      .set({ ...values, ...(converted ? { convertedAt: new Date().toISOString().slice(0, 10) } : {}) })
      .where(and(eq(member.id, id), eq(member.churchId, church.id)));
    logActivity({
      module: "members",
      actionCode: "members.update",
      action: `Updated member "${values.fullName}"`,
      metadata: { memberId: id, fullName: values.fullName, category: values.category },
    });
  } else {
    const memberIdCode = await generateMemberIdCode(church.name);
    const [created] = await db
      .insert(member)
      .values({ ...values, memberIdCode, churchId: church.id })
      .returning({ id: member.id, memberIdCode: member.memberIdCode });

    if (values.phone) {
      const first = values.fullName.split(/\s+/)[0];
      if (values.category === VISITOR || values.category === REGULAR_ATTENDEE) {
        if (church.autoWelcomeSms) {
          await sendSms(
            church,
            [values.phone],
            withFooter(
              church,
              `Hi ${first}, thank you for worshipping with us at ${church.name}! We're glad you came and hope to see you again soon.`
            ),
            {
              kind: "welcome",
              audience: values.fullName,
            }
          );
        }
      } else {
        // Full members receive their Member Portal ID and portal login link automatically via SMS
        const portalUrl = await getPortalUrl(memberIdCode);
        await sendSms(
          church,
          [values.phone],
          withFooter(
            church,
            `Hi ${first}, welcome to ${church.name}! Your unique Member ID is: ${memberIdCode}. Sign into your member portal here: ${portalUrl} to view your tithes, welfare dues, and update your profile.`
          ),
          {
            kind: "portal_invite",
            audience: values.fullName,
            topic: "Member Portal ID",
          }
        );
      }
    }

    logActivity({
      module: "members",
      actionCode: "members.create",
      action: `Added member "${values.fullName}" (ID: ${memberIdCode})`,
      metadata: { memberId: created.id, fullName: values.fullName, category: values.category, memberIdCode },
    });
  }
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/visitor-conversion");

  revalidatePath("/sob");
  return { ok: true };
}

export async function sendPortalInviteSms(memberId: string): Promise<{ ok: boolean; error?: string }> {
  await requireModule("members");
  const { church } = await requireChurch();
  const [m] = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      memberIdCode: schema.member.memberIdCode,
    })
    .from(schema.member)
    .where(and(eq(schema.member.id, memberId), eq(schema.member.churchId, church.id)))
    .limit(1);

  if (!m) return { ok: false, error: "Member not found." };
  if (!m.phone) return { ok: false, error: "Member does not have a phone number on file." };

  let code = m.memberIdCode;
  if (!code) {
    code = await generateMemberIdCode(church.name);
    await db
      .update(schema.member)
      .set({ memberIdCode: code })
      .where(eq(schema.member.id, m.id));
  }

  const portalUrl = await getPortalUrl(code);
  const first = m.fullName.split(/\s+/)[0];
  const smsRes = await sendSms(
    church,
    [m.phone],
    withFooter(
      church,
      `Hi ${first}, your unique ${church.name} Member ID is: ${code}. Sign into your member portal at: ${portalUrl} to view your tithes, welfare dues, and pastoral support.`
    ),
    {
      kind: "portal_invite",
      audience: m.fullName,
      topic: "Member Portal ID",
    }
  );

  if (smsRes.status === "failed") {
    return { ok: false, error: smsRes.error || "Failed to send SMS." };
  }

  logActivity({
    module: "members",
    actionCode: "members.portal_sms",
    action: `Sent Member Portal ID to "${m.fullName}" (${code})`,
    metadata: { memberId: m.id, code },
  });

  return { ok: true };
}

export async function setMemberActive(id: string, active: boolean) {
  await requireModule("members");
  const { church } = await requireChurch();
  const [updated] = await db
    .update(member)
    .set({ active })
    .where(and(eq(member.id, id), eq(member.churchId, church.id)))
    .returning({ fullName: member.fullName });
  logActivity({
    module: "members",
    actionCode: active ? "members.activate" : "members.deactivate",
    action: `${active ? "Activated" : "Deactivated"} member "${updated?.fullName || "Member"}"`,
    metadata: { memberId: id, fullName: updated?.fullName, active },
  });
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function deleteMember(id: string) {
  await requireModule("members");
  const { church } = await requireChurch();
  const [deleted] = await db
    .delete(member)
    .where(and(eq(member.id, id), eq(member.churchId, church.id)))
    .returning({ fullName: member.fullName, category: member.category });
  logActivity({
    module: "members",
    actionCode: "members.delete",
    action: `Deleted member "${deleted?.fullName || "Member"}"`,
    metadata: { memberId: id, fullName: deleted?.fullName, category: deleted?.category },
  });
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

/** Import members from a CSV with duplicate detection and automated Member ID generation. */
export async function importMembers(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("members");
  const { church } = await requireChurch();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };

  const rows = parseCsv(await file.text());
  const header = rows.shift()?.map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, "")) ?? [];
  const col = (row: string[], ...names: string[]) => {
    const i = header.findIndex((h) => names.includes(h));
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  // Fetch all existing members in this branch for duplicate detection
  const existingMembers = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      email: schema.member.email,
    })
    .from(schema.member)
    .where(eq(schema.member.churchId, church.id));

  const existingPhoneCores = new Set<string>();
  const existingNames = new Set<string>();
  const existingTokens = new Set<string>();
  const existingEmails = new Set<string>();

  for (const m of existingMembers) {
    if (m.phone) {
      const d = m.phone.replace(/\D/g, "");
      if (d.length >= 8) existingPhoneCores.add(d.slice(-9));
    }
    if (m.fullName) {
      const n = normalizeName(m.fullName);
      const t = getNameTokens(m.fullName);
      if (n) existingNames.add(n);
      if (t) existingTokens.add(t);
    }
    if (m.email) existingEmails.add(m.email.trim().toLowerCase());
  }

  const rawValues = rows
    .map((row) => {
      const f = new FormData();
      f.set("fullName", col(row, "fullname", "name"));
      f.set("photoUrl", col(row, "photourl", "photo", "image", "picture"));
      f.set("phone", col(row, "phone", "phonenumber"));
      f.set("email", col(row, "email"));
      f.set("gender", col(row, "gender"));
      f.set("category", col(row, "ministry", "category", "membercategory"));
      f.set("baptized", /^(yes|true|baptized)$/i.test(col(row, "baptized", "baptismstatus")) ? "Baptized" : "");
      f.set("maritalStatus", col(row, "maritalstatus"));
      f.set("occupation", col(row, "occupation", "profession"));
      f.set("address", col(row, "address", "residentialaddress"));
      f.set("departmentId", col(row, "department", "departmentid"));
      f.set("dateOfBirth", col(row, "dateofbirth", "birthday"));
      f.set("weddingAnniversary", col(row, "weddinganniversary", "anniversary"));
      return { ...readMember(f), churchId: church.id };
    })
    .filter((v) => v.fullName);

  if (rawValues.length === 0) return { error: "No rows with a valid name were found in that file." };

  const toInsert: Array<typeof rawValues[number] & { memberIdCode: string }> = [];
  let skippedDuplicates = 0;

  for (const item of rawValues) {
    const cleanName = normalizeName(item.fullName);
    const nameTokens = getNameTokens(item.fullName);
    const phoneDigits = item.phone ? item.phone.replace(/\D/g, "") : "";
    const phoneCore = phoneDigits.length >= 8 ? phoneDigits.slice(-9) : "";
    const cleanEmail = item.email ? item.email.trim().toLowerCase() : "";

    const isDup =
      (phoneCore && existingPhoneCores.has(phoneCore)) ||
      (cleanName && (existingNames.has(cleanName) || existingTokens.has(nameTokens))) ||
      (cleanEmail && existingEmails.has(cleanEmail));

    if (isDup) {
      skippedDuplicates++;
      continue;
    }

    // Add to sets to also prevent duplicate rows within the same CSV file
    if (phoneCore) existingPhoneCores.add(phoneCore);
    if (cleanName) existingNames.add(cleanName);
    if (nameTokens) existingTokens.add(nameTokens);
    if (cleanEmail) existingEmails.add(cleanEmail);

    const memberIdCode = await generateMemberIdCode(church.name);
    toInsert.push({ ...item, memberIdCode });
  }

  if (toInsert.length === 0) {
    return {
      error: `All ${skippedDuplicates} member(s) in this CSV file already exist in this church branch. No duplicates were added.`,
    };
  }

  await db.insert(member).values(toInsert);

  logActivity({
    module: "members",
    actionCode: "members.import",
    action: `Imported ${toInsert.length} members from CSV (${skippedDuplicates} duplicate(s) skipped)`,
    metadata: { count: toInsert.length, skipped: skippedDuplicates },
  });

  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { ok: true };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
