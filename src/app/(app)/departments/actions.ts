"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const { department } = schema;

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function saveDepartment(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("members");
  const { church } = await requireChurch();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Department name is required." };

  const id = String(form.get("id") ?? "");
  if (id) {
    await db
      .update(department)
      .set({ name })
      .where(and(eq(department.id, id), eq(department.churchId, church.id)));
    logActivity({
      module: "departments",
      actionCode: "departments.update",
      action: `Updated department "${name}"`,
      metadata: { departmentId: id, name },
    });
  } else {
    await db.insert(department).values({ name, churchId: church.id });
    logActivity({
      module: "departments",
      actionCode: "departments.create",
      action: `Created department "${name}"`,
      metadata: { name },
    });
  }

  revalidatePath("/departments");
  revalidatePath("/members");
  return { ok: true };
}

export async function deleteDepartment(id: string) {
  await requireModule("members");
  const { church } = await requireChurch();
  await db.delete(department).where(and(eq(department.id, id), eq(department.churchId, church.id)));
  logActivity({
    module: "departments",
    actionCode: "departments.delete",
    action: "Deleted department",
    metadata: { departmentId: id },
  });
  revalidatePath("/departments");
  revalidatePath("/members");
}
