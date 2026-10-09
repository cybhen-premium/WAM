"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
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
    .select()
    .from(schema.member)
    .where(and(eq(schema.member.id, memberId), eq(schema.member.churchId, church.id)))
    .limit(1);

  if (!m) return { ok: false, error: "Member not found" };
  if (!m.phone) return { ok: false, error: "Member does not have a registered phone number" };

  let code = m.memberIdCode;
  if (!code) {
    code = await generateMemberIdCode(church.name);
    await db.update(schema.member).set({ memberIdCode: code }).where(eq(schema.member.id, m.id));
  }

  const first = m.fullName.split(/\s+/)[0];
  const portalUrl = await getPortalUrl(code);
  const smsBody = withFooter(
    church,
    `Hi ${first}, your Member ID for ${church.name} is: ${code}. Sign into your member portal here: ${portalUrl} to view your tithes, welfare dues, and update your profile.`
  );

  const res = await sendSms(church, [m.phone], smsBody, {
    kind: "portal_invite",
    audience: m.fullName,
    topic: "Member Portal ID",
  });

  if (res.status === "failed") {
    return { ok: false, error: res.error || "Failed to send SMS." };
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

/** Import members from a CSV with a header row (same columns as the export). */
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

  const values = rows
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

  if (values.length === 0) return { error: "No rows with a name were found in that file." };
  await db.insert(member).values(values);
  logActivity({
    module: "members",
    actionCode: "members.import",
    action: `Imported ${values.length} members from CSV`,
    metadata: { count: values.length },
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
