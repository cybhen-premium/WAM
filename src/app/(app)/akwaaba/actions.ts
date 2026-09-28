"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { MEMBER_CATEGORIES } from "@/lib/constants";
import { sendSms, withFooter } from "@/lib/sms";

const { member, followUp } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

function readPerson(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const opt = (k: string) => s(k) || null;
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s(k)) ? s(k) : null);
  const gender = s("gender").toLowerCase();
  const status = s("status"); // "visiting" or "staying"
  return {
    fullName: s("fullName"),
    phone: opt("phone"),
    email: opt("email"),
    gender: gender === "male" || gender === "female" ? gender : null,
    category: status.toLowerCase() === "staying" ? "Regular Attendee" : "Visitor",
    address: opt("address"),
    invitedBy: opt("invitedBy"),
    joinedAt: date("joinedAt") || undefined,
  } as const;
}

/** Register a new person through Akwaaba (reception pathway) */
export async function registerPerson(_prev: FormState, form: FormData): Promise<FormState> {
  const { church } = await requireChurch();
  const values = readPerson(form);
  if (!values.fullName) return { error: "Full name is required." };

  const [created] = await db
    .insert(member)
    .values({ 
      ...values, 
      churchId: church.id,
      baptized: false, // Not baptized until SOB completion
    })
    .returning({ id: member.id });

  // New people enter the follow-up pipeline and optionally get a welcome SMS
  await db.insert(followUp).values({ churchId: church.id, memberId: created.id, kind: "convert", stage: "new" });
  
  if (church.autoWelcomeSms && values.phone) {
    const first = values.fullName.split(/\s+/)[0];
    await sendSms(church, [values.phone], withFooter(church, `Akwaaba! Welcome ${first}, thank you for joining us at ${church.name}! We're blessed to have you with us.`), {
      kind: "welcome",
      audience: values.fullName,
    });
  }

  revalidatePath("/akwaaba");
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/follow-up");
  return { ok: true };
}

export async function setPersonActive(id: string, active: boolean) {
  const { church } = await requireChurch();
  await db
    .update(member)
    .set({ active })
    .where(and(eq(member.id, id), eq(member.churchId, church.id)));
  revalidatePath("/akwaaba");
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function deletePerson(id: string) {
  const { church } = await requireChurch();
  await db.delete(member).where(and(eq(member.id, id), eq(member.churchId, church.id)));
  revalidatePath("/akwaaba");
  revalidatePath("/members");
  revalidatePath("/dashboard");
}
