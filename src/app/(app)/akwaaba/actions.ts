"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { MEMBER_CATEGORIES } from "@/lib/constants";
import { sendSms, withFooter } from "@/lib/sms";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const { member } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

function readPerson(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const opt = (k: string) => s(k) || null;
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s(k)) ? s(k) : null);
  const gender = s("gender").toLowerCase();
  const status = s("status").toLowerCase(); // "visiting" or "staying"
  const akwaabaStatus = status === "staying" ? "staying" : "visiting";
  const id = s("id");
  return {
    id: id || null,
    fullName: s("fullName"),
    phone: opt("phone"),
    email: opt("email"),
    gender: gender === "male" || gender === "female" ? gender : null,
    category: akwaabaStatus === "staying" ? "Regular Attendee" : "Visitor",
    akwaabaStatus,
    address: opt("address"),
    invitedBy: opt("invitedBy"),
    departmentId: opt("departmentId"),
    joinedAt: date("joinedAt") || undefined,
  } as const;
}

/** Register or update a person through Akwaaba (reception pathway) */
export async function registerPerson(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("akwaaba");
  const { church } = await requireChurch();
  const values = readPerson(form);
  if (!values.fullName) return { error: "Full name is required." };

  if (values.id) {
    const [existing] = await db
      .select({ category: member.category, convertedAt: member.convertedAt, akwaabaStatus: member.akwaabaStatus })
      .from(member)
      .where(and(eq(member.id, values.id), eq(member.churchId, church.id)))
      .limit(1);

    // If the person has graduated or become a full member (e.g. General Member),
    // don't demote their main membership category. Also preserve "visiting" intake record if they originally visited and converted.
    const isFullMember = existing && existing.category !== "Visitor" && existing.category !== "Regular Attendee";
    const preserveVisiting = !!existing?.convertedAt;

    // Update existing person. `fromAkwaaba` is deliberately left alone — it records how they arrived,
    // so someone who has since graduated to a full member keeps appearing on the Akwaaba list.
    await db
      .update(member)
      .set({
        fullName: values.fullName,
        phone: values.phone,
        email: values.email,
        gender: values.gender,
        ...(isFullMember ? {} : { category: values.category }),
        akwaabaStatus: preserveVisiting ? "visiting" : values.akwaabaStatus,
        address: values.address,
        invitedBy: values.invitedBy,
        departmentId: values.departmentId,
        joinedAt: values.joinedAt,
      })
      .where(and(eq(member.id, values.id), eq(member.churchId, church.id)));
    logActivity({
      module: "akwaaba",
      actionCode: "akwaaba.update",
      action: `Updated visitor "${values.fullName}"`,
      metadata: { memberId: values.id, fullName: values.fullName, category: values.category },
    });
  } else {
    // Check for existing duplicates in this church branch
    const existing = await db
      .select({
        id: member.id,
        fullName: member.fullName,
        phone: member.phone,
        category: member.category,
      })
      .from(member)
      .where(eq(member.churchId, church.id));

    const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const getNameTokens = (s: string) => normalizeName(s).split(" ").filter(Boolean).sort().join(" ");

    const cleanName = normalizeName(values.fullName);
    const nameTokens = getNameTokens(values.fullName);
    const phoneDigits = values.phone ? values.phone.replace(/\D/g, "") : "";
    const phoneCore = phoneDigits.length >= 8 ? phoneDigits.slice(-9) : "";

    for (const m of existing) {
      const mCleanName = normalizeName(m.fullName ?? "");
      const mNameTokens = getNameTokens(m.fullName ?? "");
      const mDigits = m.phone ? m.phone.replace(/\D/g, "") : "";
      const mCore = mDigits.length >= 8 ? mDigits.slice(-9) : "";

      const nameMatches = Boolean(
        cleanName &&
        cleanName.length >= 2 &&
        (mCleanName === cleanName || (nameTokens && nameTokens.length >= 3 && mNameTokens === nameTokens))
      );
      const phoneMatches = Boolean(phoneCore && mCore && phoneCore === mCore);

      if (phoneMatches) {
        return {
          error: `A person with phone number "${values.phone}" already exists in this church branch: ${m.fullName} (${m.category}). Please find them in the directory instead of creating a duplicate.`,
        };
      }
      if (nameMatches) {
        const isTransposed = mCleanName !== cleanName && mNameTokens === nameTokens;
        return {
          error: isTransposed
            ? `A person named "${m.fullName}" (same name in different word order) is already registered in this church branch (${m.category}). Please find them in the directory instead of adding a duplicate.`
            : `A person named "${m.fullName}" is already registered in this church branch (${m.category}). Please find them in the directory instead of adding a duplicate.`,
        };
      }
    }

    // Create new person
    const [created] = await db
      .insert(member)
      .values({
        fullName: values.fullName,
        phone: values.phone,
        email: values.email,
        gender: values.gender,
        category: values.category,
        akwaabaStatus: values.akwaabaStatus,
        address: values.address,
        invitedBy: values.invitedBy,
        departmentId: values.departmentId,
        joinedAt: values.joinedAt,
        churchId: church.id,
        baptized: false, // Not baptized until SOB completion
        fromAkwaaba: true, // Received through Akwaaba — kept on the list even after baptism
      })
      .returning({ id: member.id });

    logActivity({
      module: "akwaaba",
      actionCode: "akwaaba.create",
      action: `Registered new visitor "${values.fullName}" via Akwaaba`,
      metadata: { memberId: created.id, fullName: values.fullName, category: values.category },
    });

    if (church.autoWelcomeSms && values.phone) {
      const first = values.fullName.split(/\s+/)[0];
      await sendSms(church, [values.phone], withFooter(church, `Akwaaba! Welcome ${first}, thank you for joining us at ${church.name}! We're blessed to have you with us.`), {
        kind: "welcome",
        audience: values.fullName,
      });
    }
  }

  revalidatePath("/akwaaba");
  revalidatePath("/members");
  revalidatePath("/dashboard");

  return { ok: true };
}

export async function setPersonActive(id: string, active: boolean) {
  await requireModule("akwaaba");
  const { church } = await requireChurch();
  const [updated] = await db
    .update(member)
    .set({ active })
    .where(and(eq(member.id, id), eq(member.churchId, church.id)))
    .returning({ fullName: member.fullName });
  logActivity({
    module: "akwaaba",
    actionCode: active ? "akwaaba.activate" : "akwaaba.deactivate",
    action: `${active ? "Activated" : "Deactivated"} visitor "${updated?.fullName || "Visitor"}"`,
    metadata: { memberId: id, fullName: updated?.fullName, active },
  });
  revalidatePath("/akwaaba");
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function deletePerson(id: string) {
  await requireModule("akwaaba");
  const { church } = await requireChurch();
  const [deleted] = await db
    .delete(member)
    .where(and(eq(member.id, id), eq(member.churchId, church.id)))
    .returning({ fullName: member.fullName });
  logActivity({
    module: "akwaaba",
    actionCode: "akwaaba.delete",
    action: `Deleted visitor "${deleted?.fullName || "Visitor"}" from Akwaaba`,
    metadata: { memberId: id, fullName: deleted?.fullName },
  });
  revalidatePath("/akwaaba");
  revalidatePath("/members");
  revalidatePath("/dashboard");
}
