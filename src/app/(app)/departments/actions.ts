"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";

const { department } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function saveDepartment(_prev: FormState, form: FormData): Promise<FormState> {
  const { church } = await requireChurch();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Department name is required." };

  const id = String(form.get("id") ?? "");
  if (id) {
    await db
      .update(department)
      .set({ name })
      .where(and(eq(department.id, id), eq(department.churchId, church.id)));
  } else {
    await db.insert(department).values({ name, churchId: church.id });
  }

  revalidatePath("/departments");
  revalidatePath("/members");
  return { ok: true };
}

export async function deleteDepartment(id: string) {
  const { church } = await requireChurch();
  await db.delete(department).where(and(eq(department.id, id), eq(department.churchId, church.id)));
  revalidatePath("/departments");
  revalidatePath("/members");
}
