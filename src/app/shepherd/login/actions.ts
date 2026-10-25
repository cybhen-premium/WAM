"use server";

import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { createShepherdSession, verifyPassword } from "@/lib/shepherd-portal";

export async function loginShepherd(
  identifier: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanId = identifier.trim();
  const cleanPass = password.trim();

  if (!cleanId) return { ok: false, error: "Please enter your Phone, Email, or Shepherd ID." };
  if (!cleanPass) return { ok: false, error: "Please enter your password." };

  try {
    const [shepherd] = await db
      .select()
      .from(schema.shepherd)
      .where(
        and(
          eq(schema.shepherd.active, true),
          or(
            eq(schema.shepherd.phone, cleanId),
            eq(schema.shepherd.email, cleanId.toLowerCase()),
            eq(schema.shepherd.shepherdCode, cleanId.toUpperCase())
          )
        )
      )
      .limit(1);

    if (!shepherd) {
      return { ok: false, error: "No active shepherd account found with those details." };
    }

    const isValid = verifyPassword(cleanPass, shepherd.passwordHash);
    if (!isValid) {
      if (shepherd.staffId) {
        return {
          ok: false,
          error:
            "This shepherd account is linked to church staff. Please sign in to the Church Staff Portal (/login) to access the Shepherd Portal directly from your sidebar.",
        };
      }
      return { ok: false, error: "Invalid password. Please check your credentials and try again." };
    }

    await createShepherdSession(shepherd.id);
    return { ok: true };
  } catch (err: any) {
    console.error("[loginShepherd] error:", err);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
