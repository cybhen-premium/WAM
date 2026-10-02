"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { MODULE_KEYS } from "@/lib/modules";
import { logActivity } from "@/lib/activity";

const { church, staff, staffModule } = schema;

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined;

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string) => s(f, k) || null;

async function requireAdmin() {
  const ctx = await requireChurch();
  if (ctx.role !== "admin") throw new Error("Only admins can change settings.");
  return ctx;
}

function done(message: string): FormState {
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message };
}

export async function saveProfile(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("settings");
  const { church: c } = await requireAdmin();
  const name = s(f, "name");
  if (!name) return { error: "Church name is required." };
  const coord = (k: string, max: number) => {
    const n = Number(s(f, k));
    return s(f, k) && Number.isFinite(n) && Math.abs(n) <= max ? n.toFixed(6) : null;
  };
  await db
    .update(church)
    .set({
      name,
      pastorName: opt(f, "pastorName"),
      phone: opt(f, "phone"),
      email: opt(f, "email"),
      location: opt(f, "location"),
      ghanaPostGps: opt(f, "ghanaPostGps")?.toUpperCase() ?? null,
      directions: opt(f, "directions"),
      latitude: coord("latitude", 90),
      longitude: coord("longitude", 180),
    })
    .where(eq(church.id, c.id));
  logActivity({
    module: "settings",
    action: `Updated church profile (${name})`,
    metadata: { name },
  });
  return done("Profile saved.");
}

export async function saveBranding(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("settings");
  const { church: c } = await requireAdmin();
  const color = (k: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(s(f, k)) ? s(f, k) : fallback);
  const logo = s(f, "logoUrl");
  if (logo && !/^(https:\/\/|data:image\/|\/)/.test(logo)) return { error: "Logo must be a valid image URL or upload." };
  await db
    .update(church)
    .set({
      logoUrl: logo || null,
      brandPrimary: color("brandPrimary", "#1e3a8a"),
      brandSecondary: color("brandSecondary", "#f59e0b"),
      receiptTemplate: ["classic", "modern", "minimal"].includes(s(f, "receiptTemplate")) ? s(f, "receiptTemplate") : "classic",
      receiptFont: ["Arial", "Roboto", "Times New Roman", "Inter"].includes(s(f, "receiptFont")) ? s(f, "receiptFont") : "Arial",
      receiptWatermark: f.get("receiptWatermark") === "on",
    })
    .where(eq(church.id, c.id));
  logActivity({
    module: "settings",
    action: "Updated branding settings",
  });
  return done("Branding saved.");
}

export async function setAutoWelcome(enabled: boolean) {
  await requireModule("settings");
  const { church: c } = await requireAdmin();
  await db.update(church).set({ autoWelcomeSms: enabled }).where(eq(church.id, c.id));
  logActivity({
    module: "settings",
    action: `${enabled ? "Enabled" : "Disabled"} auto-welcome SMS`,
    metadata: { enabled },
  });
  revalidatePath("/settings");
}

export async function requestSenderId(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("settings");
  const { church: c } = await requireAdmin();
  const id = s(f, "senderId");
  // Telcos require 3-11 alphanumeric characters, starting with a letter.
  if (!/^[A-Za-z][A-Za-z0-9 ]{2,10}$/.test(id)) return { error: "Use 3–11 letters or numbers, starting with a letter." };
  await db.update(church).set({ senderId: id, senderIdStatus: "approved" }).where(eq(church.id, c.id));
  return done("Sender ID successfully set and approved.");
}

export async function savePreferences(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("settings");
  const { church: c } = await requireAdmin();
  const weeks = Math.min(12, Math.max(1, Math.round(Number(s(f, "absenceThresholdWeeks")) || 3)));
  await db
    .update(church)
    .set({
      appendFooter: f.get("appendFooter") === "on",
      absenceThresholdWeeks: weeks,
      aiLanguage: ["English", "Twi", "Ga", "Ewe", "French"].includes(s(f, "aiLanguage")) ? s(f, "aiLanguage") : "English",
      aiTone: s(f, "aiTone") || "Warm & Pastoral",
    })
    .where(eq(church.id, c.id));
  return done("Preferences saved.");
}

/* Staff -------------------------------------------------------------------- */

const ROLES = ["admin", "pastor", "finance", "secretary", "usher"] as const;

export async function inviteStaff(_prev: FormState, f: FormData): Promise<FormState> {
  await requireModule("settings");
  const { church: c } = await requireAdmin();
  const email = s(f, "email").toLowerCase();
  const role = ROLES.find((r) => r === s(f, "role")) ?? "secretary";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };

  const [existing] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.churchId, c.id), eq(staff.email, email)))
    .limit(1);
  if (existing) return { error: "That email already has access or a pending invite." };

  await db.insert(staff).values({ churchId: c.id, email, role, status: "pending" });
  return done(`Invitation created. Ask ${email} to sign up. They'll be offered to join ${c.name}.`);
}

export async function changeRole(staffId: string, role: string) {
  await requireModule("settings");
  const { church: c, user } = await requireAdmin();
  const r = ROLES.find((x) => x === role);
  if (!r) return;
  // An admin can't demote themselves (prevents locking everyone out).
  await db
    .update(staff)
    .set({ role: r })
    .where(and(eq(staff.id, staffId), eq(staff.churchId, c.id), ne(staff.userId, user.id)));
  revalidatePath("/settings");
}

export async function removeStaff(staffId: string) {
  await requireModule("settings");
  const { church: c, user } = await requireAdmin();
  const [row] = await db.select().from(staff).where(and(eq(staff.id, staffId), eq(staff.churchId, c.id))).limit(1);
  if (!row || row.userId === user.id) return;
  await db.delete(staff).where(eq(staff.id, staffId));
  revalidatePath("/settings");
}

/**
 * Superadmin-only: replace the modules a staff member may access. Admins are not affected — they always
 * have everything — so this is where you scope everyone else.
 */
export async function setStaffModules(staffId: string, modules: string[]) {
  await requireModule("settings");
  const { church: c } = await requireAdmin();

  const [target] = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.churchId, c.id)))
    .limit(1);
  if (!target || target.role === "admin") return; // admins keep full access

  const wanted = MODULE_KEYS.filter((k) => modules.includes(k));
  await db.delete(staffModule).where(and(eq(staffModule.churchId, c.id), eq(staffModule.staffId, staffId)));
  if (wanted.length) {
    await db
      .insert(staffModule)
      .values(wanted.map((module) => ({ churchId: c.id, staffId, module })));
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

/** Sets the 2FA method required for the super admin (church owner). */
export async function setSuperAdminTwoFactor(method: string) {
  await requireModule("settings");
  const { church: c, role } = await requireChurch();
  if (role !== "admin") throw new Error("Only the church owner can change this setting.");
  const allowed = ["none", "email", "totp"];
  if (!allowed.includes(method)) throw new Error("Invalid method.");
  await db.update(church).set({ ownerTwoFactorMethod: method }).where(eq(church.id, c.id));
  revalidatePath("/settings");
}
