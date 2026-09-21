import "server-only";
import type { IntegrationConfig } from "@/lib/platform";

/**
 * How each SMS provider sends (field definitions live in lib/integrations.ts).
 * Preset endpoints follow each provider's public API docs; if one changes,
 * use the "custom" provider to paste the new request format without a code change.
 */

type Send = (cfg: IntegrationConfig, sender: string, recipients: string[], message: string) => Promise<void>;

async function check(res: Response, provider: string) {
  const text = await res.text();
  if (!res.ok) throw new Error(`${provider} returned ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

const senders: Record<string, Send> = {
  async arkesel(cfg, sender, recipients, message) {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "api-key": cfg.values.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message, recipients }),
    });
    await check(res, "Arkesel");
  },

  async hubtel(cfg, sender, recipients, message) {
    // Hubtel's quick-send endpoint takes one recipient per request.
    for (const to of recipients) {
      const url = new URL("https://smsc.hubtel.com/v1/messages/send");
      url.search = new URLSearchParams({
        clientid: cfg.values.clientId,
        clientsecret: cfg.values.clientSecret,
        from: sender,
        to,
        content: message,
      }).toString();
      await check(await fetch(url), "Hubtel");
    }
  },

  async mnotify(cfg, sender, recipients, message) {
    const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(cfg.values.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: recipients, sender, message, is_schedule: false, schedule_date: "" }),
    });
    const text = await check(res, "mNotify");
    // mNotify answers 200 with {"status":"error"} on failures.
    if (/"status"\s*:\s*"error"/i.test(text)) throw new Error(`mNotify: ${text.slice(0, 200)}`);
  },

  async custom(cfg, sender, recipients, message) {
    const v = cfg.values;
    const method = v.method === "GET" ? "GET" : "POST";
    const isJson = (v.body ?? "").trim().startsWith("{") || (v.body ?? "").trim().startsWith("[");
    const batches = v.mode === "single" ? recipients.map((r) => [r]) : [recipients];

    for (const batch of batches) {
      const vars: Record<string, string> = {
        to: batch[0],
        to_csv: batch.join(","),
        to_list: JSON.stringify(batch),
        message,
        sender,
        api_key: v.apiKey ?? "",
      };
      // Escape per destination: URL-encode in the URL, JSON-escape inside JSON strings.
      const fill = (tpl: string, esc: (s: string) => string) =>
        tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (k === "to_list" ? vars.to_list : esc(vars[k] ?? "")));
      const jsonEsc = (s: string) => JSON.stringify(s).slice(1, -1);

      const url = fill(v.url, encodeURIComponent);
      const headers: Record<string, string> = v.headers?.trim() ? JSON.parse(fill(v.headers, jsonEsc)) : {};
      const body = method === "POST" && v.body?.trim() ? fill(v.body, isJson ? jsonEsc : encodeURIComponent) : undefined;
      if (body && !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
        headers["Content-Type"] = isJson ? "application/json" : "application/x-www-form-urlencoded";
      }
      await check(await fetch(url, { method, headers, body }), "Provider");
    }
  },
};

export function sendWithProvider(cfg: IntegrationConfig, sender: string, recipients: string[], message: string) {
  const send = senders[cfg.provider];
  if (!send) throw new Error(`Unknown SMS provider "${cfg.provider}".`);
  return send(cfg, sender, recipients, message);
}
