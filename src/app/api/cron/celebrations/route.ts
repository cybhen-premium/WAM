import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { fillTemplate, isToday } from "@/lib/pastoral";
import { sendSms, withFooter } from "@/lib/sms";

const { church, member, messageLog } = schema;

function isAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim().replace(/^["']|["']$/g, "");
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

/**
 * Sends today's birthday and anniversary SMS for every church with automation switched on.
 * Called by Vercel Cron (see vercel.ts), which sends `Authorization: Bearer $CRON_SECRET`.
 * Safe to re-run: members already messaged today are skipped.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const churches = await db.select().from(church).where(eq(church.automationEnabled, true));
  const summary: Record<string, number> = {};

  for (const c of churches) {
    for (const kind of ["birthday", "anniversary"] as const) {
      const col = kind === "birthday" ? member.dateOfBirth : member.weddingAnniversary;
      const people = await db
        .select({ id: member.id, fullName: member.fullName, phone: member.phone })
        .from(member)
        .where(
          and(
            eq(member.churchId, c.id),
            eq(member.active, true),
            isToday(col),
            sql`${member.phone} is not null`,
            // Skip anyone already greeted today (topic holds the member id).
            sql`not exists (select 1 from ${messageLog} l where l.church_id = ${c.id} and l.kind = ${kind}
                 and l.topic = ${member.id}::text and l.sent_at::date = current_date)`,
          ),
        );

      for (const p of people) {
        const template = kind === "birthday" ? c.birthdayTemplate : c.anniversaryTemplate;
        await sendSms(c, [p.phone], withFooter(c, fillTemplate(template, p.fullName)), {
          kind,
          topic: p.id,
          audience: p.fullName,
        });
        summary[kind] = (summary[kind] ?? 0) + 1;
      }
    }
  }

  return Response.json({ churches: churches.length, ...summary });
}
