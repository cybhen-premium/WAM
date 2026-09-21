import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/secrets";
import { INTEGRATIONS, type IntegrationKey } from "@/lib/integrations";

/**
 * Stored in platform_setting under the integration key. Secret provider fields are encrypted;
 * `common` holds fields shared by all providers (e.g. the SMS sender ID).
 */
type Stored = { provider: string; enabled: boolean; common: Record<string, string>; values: Record<string, string> };

/** Decrypted, ready-to-use configuration. */
export type IntegrationConfig = { provider: string; common: Record<string, string>; values: Record<string, string> };

/** Platform admins are listed in PLATFORM_ADMIN_EMAILS (comma separated). */
export function isPlatformAdmin(email: string | null | undefined) {
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && admins.includes(email.toLowerCase());
}

async function readStored(key: IntegrationKey): Promise<Stored | null> {
  const [row] = await db
    .select({ value: schema.platformSetting.value })
    .from(schema.platformSetting)
    .where(eq(schema.platformSetting.key, key))
    .limit(1);
  return (row?.value as Stored) ?? null;
}

/** Active configuration with secrets decrypted, or null when not set up / switched off. Cached per request. */
export const getIntegration = cache(async (key: IntegrationKey): Promise<IntegrationConfig | null> => {
  const stored = await readStored(key);
  if (!stored?.enabled) return null;
  const def = INTEGRATIONS[key].providers.find((p) => p.id === stored.provider);
  if (!def) return null;
  const values: Record<string, string> = {};
  for (const f of def.fields) {
    const raw = stored.values[f.name];
    if (!raw) continue;
    try {
      values[f.name] = f.secret ? decrypt(raw) : raw;
    } catch {
      return null; // Unreadable secret (e.g. BETTER_AUTH_SECRET changed): treat as not configured.
    }
  }
  return { provider: stored.provider, common: stored.common ?? {}, values };
});

export type AdminView = {
  provider: string;
  enabled: boolean;
  common: Record<string, string>;
  values: Record<string, string>;
  savedSecrets: string[];
  updatedAt: string;
} | null;

/** For the admin form: plain values plus the names of stored secrets (never the secrets themselves). */
export async function getIntegrationForAdmin(key: IntegrationKey): Promise<AdminView> {
  const [row] = await db
    .select()
    .from(schema.platformSetting)
    .where(eq(schema.platformSetting.key, key))
    .limit(1);
  if (!row) return null;
  const stored = row.value as Stored;
  const def = INTEGRATIONS[key].providers.find((p) => p.id === stored.provider);
  const values: Record<string, string> = {};
  const savedSecrets: string[] = [];
  for (const f of def?.fields ?? []) {
    if (!stored.values[f.name]) continue;
    if (f.secret) savedSecrets.push(f.name);
    else values[f.name] = stored.values[f.name];
  }
  return { provider: stored.provider, enabled: stored.enabled, common: stored.common ?? {}, values, savedSecrets, updatedAt: row.updatedAt.toISOString() };
}

/**
 * Saves an integration. A blank secret keeps the stored one (so other fields can be edited
 * without re-pasting keys), as long as the provider didn't change.
 */
export async function saveIntegration(
  key: IntegrationKey,
  input: { provider: string; enabled: boolean; common: Record<string, string>; values: Record<string, string>; updatedBy: string },
) {
  const integration = INTEGRATIONS[key];
  const def = integration.providers.find((p) => p.id === input.provider);
  if (!def) throw new Error("Choose a provider.");
  const previous = await readStored(key);
  const sameProvider = previous?.provider === input.provider;

  const values: Record<string, string> = {};
  for (const f of def.fields) {
    const v = (input.values[f.name] ?? "").trim();
    if (f.secret) {
      if (v) values[f.name] = encrypt(v);
      else if (sameProvider && previous?.values[f.name]) values[f.name] = previous.values[f.name];
    } else if (v) values[f.name] = v;
    if (!f.optional && !values[f.name]) throw new Error(`${f.label} is required.`);
  }
  const common: Record<string, string> = {};
  for (const f of integration.commonFields) {
    const v = (input.common[f.name] ?? "").trim();
    if (!v && !f.optional) throw new Error(`${f.label} is required.`);
    if (v) common[f.name] = v;
  }

  const value: Stored = { provider: input.provider, enabled: input.enabled, common, values };
  await db
    .insert(schema.platformSetting)
    .values({ key, value, updatedBy: input.updatedBy })
    .onConflictDoUpdate({
      target: schema.platformSetting.key,
      set: { value, updatedBy: input.updatedBy, updatedAt: new Date() },
    });
}
