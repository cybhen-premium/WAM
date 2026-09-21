import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getIntegration } from "@/lib/platform";
import { sendWithProvider } from "@/lib/sms-providers";

type Church = typeof schema.church.$inferSelect;

export type SmsResult = { status: "sent" | "queued" | "failed"; recipients: number; creditsUsed: number; error?: string };

/** One credit per 160-character segment per recipient. */
export function creditsFor(body: string, recipients: number) {
  return Math.max(1, Math.ceil(body.length / 160)) * recipients;
}

/** Appends the church signature when "Append Footer to Broadcasts" is on. */
export function withFooter(church: Church, body: string) {
  if (!church.appendFooter) return body;
  const contact = church.phone ? ` | Tel: ${church.phone}` : "";
  return `${body}\n---\n${church.name}${contact}`;
}

/** Ghana numbers to international format: 024xxxxxxx -> 23324xxxxxxx. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  return digits.length >= 9 ? digits : null;
}

/** True when a platform admin has configured and enabled an SMS gateway (Settings → SMS Gateway). */
export async function smsProviderConfigured() {
  return (await getIntegration("sms")) !== null;
}

/**
 * Sends one message to many phones, charges SMS credits and records it in the message log.
 * Without a provider configured the message is logged as "queued" and no credits are charged.
 */
export async function sendSms(
  church: Church,
  phones: (string | null)[],
  body: string,
  meta: { kind: string; topic?: string; audience?: string },
): Promise<SmsResult> {
  const recipients = [...new Set(phones.map((p) => (p ? normalizePhone(p) : null)).filter((p): p is string => !!p))];
  const log = (status: SmsResult["status"], creditsUsed: number) =>
    db.insert(schema.messageLog).values({
      churchId: church.id,
      kind: meta.kind,
      topic: meta.topic ?? null,
      audience: meta.audience ?? null,
      status,
      recipients: recipients.length,
      body,
      creditsUsed,
    });

  if (recipients.length === 0) return { status: "failed", recipients: 0, creditsUsed: 0, error: "No valid phone numbers." };

  const config = await getIntegration("sms");
  if (!config) {
    await log("queued", 0);
    return { status: "queued", recipients: recipients.length, creditsUsed: 0 };
  }

  const cost = creditsFor(body, recipients.length);
  // Reserve credits atomically so two sends can't overspend the wallet.
  const [reserved] = await db
    .update(schema.church)
    .set({ smsCredits: sql`${schema.church.smsCredits} - ${cost}` })
    .where(and(eq(schema.church.id, church.id), gte(schema.church.smsCredits, cost)))
    .returning({ left: schema.church.smsCredits });
  if (!reserved) {
    return { status: "failed", recipients: recipients.length, creditsUsed: 0, error: `Not enough credits: this send needs ${cost}.` };
  }

  try {
    const sender = (church.senderIdStatus === "approved" && church.senderId ? church.senderId : (config.common.senderId ?? "CHURCH_APP")).slice(0, 11);
    await sendWithProvider(config, sender, recipients, body);
    await log("sent", cost);
    return { status: "sent", recipients: recipients.length, creditsUsed: cost };
  } catch (e) {
    await db
      .update(schema.church)
      .set({ smsCredits: sql`${schema.church.smsCredits} + ${cost}` })
      .where(eq(schema.church.id, church.id));
    await log("failed", 0);
    return { status: "failed", recipients: recipients.length, creditsUsed: 0, error: (e as Error).message };
  }
}
