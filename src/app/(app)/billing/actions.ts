"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireChurch } from "@/lib/session";
import { PLANS, TOPUPS, paymentsConfigured, startCheckout, yearlyPrice } from "@/lib/billing";

async function callbackUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/billing/callback`;
}

export async function buyPlan(planId: string, cycle: "monthly" | "yearly"): Promise<{ error?: string }> {
  const { church, user } = await requireChurch();
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return { error: "Unknown plan." };
  if (!(await paymentsConfigured())) return { error: "Online payments aren't set up yet. A platform admin can enable them in Settings → Integrations." };

  let url: string;
  try {
    url = await startCheckout({
      churchId: church.id,
      email: user.email,
      kind: "plan",
      description: `${plan.id}:${cycle}`,
      amount: cycle === "yearly" ? yearlyPrice(plan.monthly) : plan.monthly,
      credits: cycle === "yearly" ? plan.credits * 12 : plan.credits,
      callbackUrl: await callbackUrl(),
    });
  } catch (e) {
    return { error: `Couldn't start checkout: ${(e as Error).message}` };
  }
  redirect(url);
}

export async function buyTopup(packId: string): Promise<{ error?: string }> {
  const { church, user } = await requireChurch();
  const pack = TOPUPS.find((t) => t.id === packId);
  if (!pack) return { error: "Unknown pack." };
  if (!(await paymentsConfigured())) return { error: "Online payments aren't set up yet. A platform admin can enable them in Settings → Integrations." };

  let url: string;
  try {
    url = await startCheckout({
      churchId: church.id,
      email: user.email,
      kind: "topup",
      description: `${pack.name} top-up (${pack.credits} units)`,
      amount: pack.price,
      credits: pack.credits,
      callbackUrl: await callbackUrl(),
    });
  } catch (e) {
    return { error: `Couldn't start checkout: ${(e as Error).message}` };
  }
  redirect(url);
}
