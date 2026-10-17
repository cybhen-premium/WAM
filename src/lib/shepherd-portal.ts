import "server-only";
import { cache } from "react";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUser, getChurchForUser } from "@/lib/session";

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

/** Retrieves the current authenticated shepherd and church (memoized per request) */
export const getShepherdSession = cache(async (): Promise<{ shepherd: Shepherd; church: Church } | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SHEPHERD_SESSION_COOKIE)?.value;
  if (token) {
    const now = new Date();
    const [row] = await db
      .select({
        shepherd: schema.shepherd,
        church: schema.church,
      })
      .from(schema.shepherdSession)
      .innerJoin(schema.shepherd, eq(schema.shepherd.id, schema.shepherdSession.shepherdId))
      .innerJoin(schema.church, eq(schema.church.id, schema.shepherd.churchId))
      .where(
        and(
          eq(schema.shepherdSession.token, token),
          gt(schema.shepherdSession.expiresAt, now),
          eq(schema.shepherd.active, true)
        )
      )
      .limit(1);

    if (row) {
      return { shepherd: row.shepherd, church: row.church };
    }
  }

  // Fallback: If signed in as staff, check if linked to a shepherd record in this church
  try {
    const user = await getUser();
    if (user) {
      const churchInfo = await getChurchForUser(user.id);
      if (churchInfo) {
        const matchOr = [];
        if (churchInfo.staffId) {
          matchOr.push(eq(schema.shepherd.staffId, churchInfo.staffId));
        }
        if (user.email) {
          matchOr.push(eq(schema.shepherd.email, user.email.toLowerCase()));
        }

        if (matchOr.length > 0) {
          const [staffShepherd] = await db
            .select()
            .from(schema.shepherd)
            .where(
              and(
                eq(schema.shepherd.churchId, churchInfo.church.id),
                eq(schema.shepherd.active, true),
                or(...matchOr)
              )
            )
            .limit(1);

          if (staffShepherd) {
            return { shepherd: staffShepherd, church: churchInfo.church };
          }
        }
      }
    }
  } catch (err) {
    console.error("[getShepherdSession] Staff session fallback lookup error:", err);
  }

  return null;
});


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
