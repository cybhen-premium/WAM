import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getIntegration } from "@/lib/platform";

export type PlanId = "growth" | "abundance" | "harvest";

export const PLANS: {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  credits: number;
  features: string[];
  popular?: boolean;
}[] = [
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing ministries",
    monthly: 150,
    credits: 200,
    features: ["200 Messaging Credits/mo", "Unlimited Member Database", "Up to 3 Admin Users", "Birthday & Anniversary Tracking", "Digital Receipts & Finances"],
  },
  {
    id: "abundance",
    name: "Abundance",
    tagline: "For established churches",
    monthly: 199,
    credits: 300,
    popular: true,
    features: ["300 Messaging Credits/mo", "Up to 8 Admin Users", "Automated Birthday & Anniversary", "Giving & Growth Analytics", "Sermon AI Assistant", "Priority Email Support"],
  },
  {
    id: "harvest",
    name: "Harvest",
    tagline: "The premium experience",
    monthly: 299,
    credits: 500,
    features: ["500 Messaging Credits/mo", "Unlimited Admin Users", "Custom SMS Sender ID", "Custom Receipt Branding", "Priority Phone Support"],
  },
];

export const TOPUPS = [
  { id: "micro", name: "Micro", credits: 50, price: 20 },
  { id: "standard", name: "Standard", credits: 200, price: 75 },
  { id: "bulk", name: "Bulk", credits: 500, price: 150 },
  { id: "mega", name: "Mega", credits: 2000, price: 500 },
] as const;

/** Yearly billing = 10 months (2 months free). */
export const yearlyPrice = (monthly: number) => monthly * 10;

/** True when a platform admin has configured and enabled a payment provider (Settings → Integrations). */
export async function paymentsConfigured() {
  return (await getIntegration("payments")) !== null;
}

type Gateway = {
  /** Returns the hosted checkout URL. Amount is in GHS. */
  initialize(o: { reference: string; email: string; amount: number; callbackUrl: string; description: string }): Promise<string>;
  /** Whether the reference was paid in full (amount in GHS). */
  verify(reference: string, amount: number): Promise<boolean>;
  /** Cheap authenticated call used by the admin "Check Connection" button. */
  ping(): Promise<void>;
};

async function json(res: Response, name: string) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${name}: ${body.message ?? res.status}`);
  return body;
}

function paystack(secretKey: string): Gateway {
  const call = (path: string, init?: RequestInit) =>
    fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    }).then((r) => json(r, "Paystack"));
  return {
    async initialize(o) {
      const res = await call("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: o.email,
          amount: Math.round(o.amount * 100), // pesewas
          currency: "GHS",
          reference: o.reference,
          callback_url: o.callbackUrl,
          metadata: { description: o.description },
        }),
      });
      return res.data.authorization_url;
    },
    async verify(reference, amount) {
      const res = await call(`/transaction/verify/${encodeURIComponent(reference)}`);
      return res.data?.status === "success" && res.data.amount >= Math.round(amount * 100);
    },
    async ping() {
      await call("/balance");
    },
  };
}

function flutterwave(secretKey: string): Gateway {
  const call = (path: string, init?: RequestInit) =>
    fetch(`https://api.flutterwave.com/v3${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    }).then((r) => json(r, "Flutterwave"));
  return {
    async initialize(o) {
      const res = await call("/payments", {
        method: "POST",
        body: JSON.stringify({
          tx_ref: o.reference,
          amount: o.amount,
          currency: "GHS",
          redirect_url: o.callbackUrl,
          customer: { email: o.email },
          customizations: { title: o.description },
        }),
      });
      return res.data.link;
    },
    async verify(reference, amount) {
      const res = await call(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
      return res.data?.status === "successful" && res.data.currency === "GHS" && Number(res.data.amount) >= amount;
    },
    async ping() {
      await call("/balances");
    },
  };
}

export async function getGateway(): Promise<Gateway | null> {
  const cfg = await getIntegration("payments");
  if (!cfg?.values.secretKey) return null;
  if (cfg.provider === "paystack") return paystack(cfg.values.secretKey);
  if (cfg.provider === "flutterwave") return flutterwave(cfg.values.secretKey);
  return null;
}

/** Creates a pending payment and returns the provider's checkout URL. */
export async function startCheckout(opts: {
  churchId: string;
  email: string;
  kind: "plan" | "topup";
  description: string;
  amount: number;
  credits: number;
  callbackUrl: string;
}) {
  const reference = `es_${opts.kind}_${randomBytes(8).toString("hex")}`;
  await db.insert(schema.payment).values({
    churchId: opts.churchId,
    kind: opts.kind,
    description: opts.description,
    amount: opts.amount.toFixed(2),
    credits: opts.credits,
    reference,
  });

  const gateway = await getGateway();
  if (!gateway) throw new Error("Online payments aren't configured.");
  return gateway.initialize({
    reference,
    email: opts.email,
    amount: opts.amount,
    callbackUrl: opts.callbackUrl,
    description: opts.description.includes(":") ? `${opts.description.split(":")[0]} plan` : opts.description,
  });
}

/**
 * Verifies a payment reference with the provider and applies it once: credits for top-ups; plan, renewal date and credits for plans.
 * Description for plans is "<plan>:<cycle>" so we know what was bought.
 */
export async function settlePayment(reference: string) {
  const [p] = await db.select().from(schema.payment).where(eq(schema.payment.reference, reference)).limit(1);
  if (!p) return { ok: false, message: "Unknown payment." };
  if (p.status === "paid") return { ok: true, message: "Payment already applied." };

  const gateway = await getGateway();
  if (!gateway) return { ok: false, message: "Payments aren't configured, so this payment can't be verified." };
  const paid = await gateway.verify(reference, Number(p.amount)).catch(() => false);
  if (!paid) {
    await db.update(schema.payment).set({ status: "failed" }).where(eq(schema.payment.id, p.id));
    return { ok: false, message: "Payment was not completed." };
  }

  // Flip to paid first so a double callback can't apply credits twice.
  const [claimed] = await db
    .update(schema.payment)
    .set({ status: "paid" })
    .where(and(eq(schema.payment.id, p.id), eq(schema.payment.status, "pending")))
    .returning({ id: schema.payment.id });
  if (!claimed) return { ok: true, message: "Payment already applied." };

  if (p.kind === "plan") {
    await awardReferralBonus(p.churchId, p.id);
    const [plan, cycle] = p.description.split(":") as [PlanId, "monthly" | "yearly"];
    await db
      .update(schema.church)
      .set({
        plan,
        billingCycle: cycle,
        renewsAt: sql`current_date + ${cycle === "yearly" ? "1 year" : "1 month"}::interval`,
        smsCredits: sql`${schema.church.smsCredits} + ${p.credits}`,
      })
      .where(eq(schema.church.id, p.churchId));
  } else {
    await db
      .update(schema.church)
      .set({ smsCredits: sql`${schema.church.smsCredits} + ${p.credits}` })
      .where(eq(schema.church.id, p.churchId));
  }
  return { ok: true, message: `Payment received. ${p.credits} credits added.` };
}

const REFERRAL_BONUS = 100;

/** On a church's first paid plan, both it and its referrer get bonus credits. */
async function awardReferralBonus(churchId: string, paymentId: string) {
  const [c] = await db
    .select({ referredBy: schema.church.referredBy })
    .from(schema.church)
    .where(eq(schema.church.id, churchId))
    .limit(1);
  if (!c?.referredBy) return;
  const [earlier] = await db
    .select({ id: schema.payment.id })
    .from(schema.payment)
    .where(
      and(
        eq(schema.payment.churchId, churchId),
        eq(schema.payment.kind, "plan"),
        eq(schema.payment.status, "paid"),
        sql`${schema.payment.id} <> ${paymentId}`,
      ),
    )
    .limit(1);
  if (earlier) return;
  const bonus = sql`${schema.church.smsCredits} + ${REFERRAL_BONUS}`;
  await db.update(schema.church).set({ smsCredits: bonus }).where(eq(schema.church.id, churchId));
  await db.update(schema.church).set({ smsCredits: bonus }).where(eq(schema.church.referralCode, c.referredBy));
}
