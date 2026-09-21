"use server";

import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { requireUser } from "@/lib/session";
import { getIntegration, isPlatformAdmin, saveIntegration } from "@/lib/platform";
import { INTEGRATIONS, type IntegrationKey } from "@/lib/integrations";
import { normalizePhone } from "@/lib/sms";
import { sendWithProvider } from "@/lib/sms-providers";
import { getGateway } from "@/lib/billing";
import { modelFor } from "@/lib/ai";

export type IntegrationState = { error?: string; ok?: boolean; message?: string } | undefined;

async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!isPlatformAdmin(user.email)) throw new Error("Only platform admins can manage integrations.");
  return user;
}

/** Provider-specific checks beyond "required fields are present". */
function validate(key: IntegrationKey, provider: string, common: Record<string, string>, values: Record<string, string>) {
  if (key === "sms" && !/^[A-Za-z][A-Za-z0-9 _]{2,10}$/.test(common.senderId?.trim() ?? "")) {
    return "Default Sender ID must be 3–11 letters or numbers and start with a letter.";
  }
  if (key === "sms" && provider === "custom") {
    if (!/^https:\/\//.test(values.url?.trim() ?? "")) return "Request URL must start with https://";
    if (values.headers?.trim()) {
      try {
        JSON.parse(values.headers.replace(/\{\{\s*\w+\s*\}\}/g, "x"));
      } catch {
        return "Headers must be valid JSON.";
      }
    }
  }
  if (key === "ai" && provider === "openai-compatible" && !/^https?:\/\//.test(values.baseUrl?.trim() ?? "")) {
    return "Base URL must start with https:// (or http:// for a local model).";
  }
  return null;
}

export async function saveIntegrationSettings(key: IntegrationKey, _prev: IntegrationState, f: FormData): Promise<IntegrationState> {
  const user = await requirePlatformAdmin();
  const integration = INTEGRATIONS[key];
  const provider = String(f.get("provider") ?? "");
  const def = integration.providers.find((p) => p.id === provider);
  if (!def) return { error: "Choose a provider." };

  const common = Object.fromEntries(integration.commonFields.map((fd) => [fd.name, String(f.get(`common_${fd.name}`) ?? "")]));
  const values = Object.fromEntries(def.fields.map((fd) => [fd.name, String(f.get(`field_${fd.name}`) ?? "")]));
  const problem = validate(key, provider, common, values);
  if (problem) return { error: problem };

  try {
    await saveIntegration(key, { provider, enabled: f.get("enabled") === "on", common, values, updatedBy: user.email });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `${integration.title} saved.` };
}

/** Exercises the saved configuration without touching church credits. */
export async function testIntegration(key: IntegrationKey, _prev: IntegrationState, f: FormData): Promise<IntegrationState> {
  await requirePlatformAdmin();
  const cfg = await getIntegration(key);
  if (!cfg) return { error: "Save and enable a provider first." };

  try {
    if (key === "sms") {
      const phone = normalizePhone(String(f.get("phone") ?? ""));
      if (!phone) return { error: "Enter a valid phone number." };
      await sendWithProvider(cfg, cfg.common.senderId ?? "CHURCH_APP", [phone], "Test message from your church platform. SMS is working!");
      return { ok: true, message: `Test sent to +${phone}. Check the phone.` };
    }
    if (key === "payments") {
      const gateway = await getGateway();
      if (!gateway) return { error: "Payment provider isn't configured." };
      await gateway.ping();
      return { ok: true, message: "Connected. The secret key was accepted." };
    }
    const { text } = await generateText({
      model: modelFor(cfg),
      prompt: "Reply with exactly: Connection OK",
      maxOutputTokens: 20,
    });
    return { ok: true, message: `Model replied: "${text.trim().slice(0, 80)}"` };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 300) };
  }
}
