import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, or } from "drizzle-orm";
import { db, schema } from "@/db";

export const SHEPHERD_SESSION_COOKIE = "wam_shepherd_session";

type Church = typeof schema.church.$inferSelect;
type Shepherd = typeof schema.shepherd.$inferSelect;

/** Secure password hashing using Node scrypt */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/** Secure timing-safe password verification */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/** Generates a human-friendly unique Shepherd ID code e.g. SHP-7K2X */
export async function generateShepherdCode(): Promise<string> {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let attempts = 0;
  while (attempts < 20) {
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(crypto.randomInt(0, chars.length));
    }
    const candidate = `SHP-${rand}`;
    const [existing] = await db
      .select({ id: schema.shepherd.id })
      .from(schema.shepherd)
      .where(eq(schema.shepherd.shepherdCode, candidate))
      .limit(1);
    if (!existing) return candidate;
    attempts++;
  }
  return `SHP-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

/** Creates a shepherd session and sets the HTTP-only cookie */
export async function createShepherdSession(shepherdId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(schema.shepherdSession).values({
    shepherdId,
    token,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SHEPHERD_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/** Retrieves the current authenticated shepherd and church */
export async function getShepherdSession(): Promise<{ shepherd: Shepherd; church: Church } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SHEPHERD_SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();
  const [sessionRow] = await db
    .select()
    .from(schema.shepherdSession)
    .where(and(eq(schema.shepherdSession.token, token), gt(schema.shepherdSession.expiresAt, now)))
    .limit(1);

  if (!sessionRow) return null;

  const [shepherdRow] = await db
    .select()
    .from(schema.shepherd)
    .where(eq(schema.shepherd.id, sessionRow.shepherdId))
    .limit(1);

  if (!shepherdRow || !shepherdRow.active) return null;

  const [churchRow] = await db
    .select()
    .from(schema.church)
    .where(eq(schema.church.id, shepherdRow.churchId))
    .limit(1);

  if (!churchRow) return null;

  return { shepherd: shepherdRow, church: churchRow };
}

/** Requires an active shepherd session or redirects to shepherd login */
export async function requireShepherd(): Promise<{ shepherd: Shepherd; church: Church }> {
  const session = await getShepherdSession();
  if (!session) {
    redirect("/shepherd/login");
  }
  return session;
}

/** Destroys the shepherd session and clears the cookie */
export async function destroyShepherdSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SHEPHERD_SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(schema.shepherdSession).where(eq(schema.shepherdSession.token, token)).catch(() => {});
  }
  cookieStore.delete(SHEPHERD_SESSION_COOKIE);
}
