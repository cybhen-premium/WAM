import "server-only";
import { createGateway, generateText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getIntegration, type IntegrationConfig } from "@/lib/platform";

type Church = typeof schema.church.$inferSelect;

/** True when a platform admin has configured and enabled an AI provider (Settings → Integrations). */
export async function aiConfigured() {
  return (await getIntegration("ai")) !== null;
}

/** Builds the AI SDK model for the stored provider configuration. */
export function modelFor(cfg: IntegrationConfig): LanguageModel {
  const { apiKey, model, baseUrl } = cfg.values;
  switch (cfg.provider) {
    case "gateway":
      return createGateway({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai-compatible":
      return createOpenAICompatible({ name: "custom", baseURL: baseUrl.replace(/\/+$/, ""), apiKey: apiKey || undefined }).chatModel(model);
    default:
      throw new AiError(`Unknown AI provider "${cfg.provider}".`);
  }
}

export class AiError extends Error {}

/**
 * Runs a prompt for a church, charging `cost` SMS credits (the original app bills AI features from the same wallet).
 * Credits are refunded if generation fails.
 */
export async function runAi(church: Church, opts: { system: string; prompt: string; cost: number; maxOutputTokens?: number }) {
  const cfg = await getIntegration("ai");
  if (!cfg) throw new AiError("AI isn't set up yet. A platform admin can enable it in Settings → Integrations.");

  if (opts.cost > 0) {
    const [ok] = await db
      .update(schema.church)
      .set({ smsCredits: sql`${schema.church.smsCredits} - ${opts.cost}` })
      .where(and(eq(schema.church.id, church.id), gte(schema.church.smsCredits, opts.cost)))
      .returning({ id: schema.church.id });
    if (!ok) throw new AiError(`This needs ${opts.cost} credits. Top up on the Billing page.`);
  }

  try {
    const { text } = await generateText({
      model: modelFor(cfg),
      system: `${opts.system}\n\nChurch: ${church.name}${church.location ? ` (${church.location})` : ""}. Write in ${church.aiLanguage}. Tone: ${church.aiTone}.`,
      prompt: opts.prompt,
      maxOutputTokens: opts.maxOutputTokens ?? 2000,
    });
    return text.trim();
  } catch (e) {
    if (opts.cost > 0) {
      await db
        .update(schema.church)
        .set({ smsCredits: sql`${schema.church.smsCredits} + ${opts.cost}` })
        .where(eq(schema.church.id, church.id));
    }
    throw new AiError(`AI request failed: ${(e as Error).message}`);
  }
}
