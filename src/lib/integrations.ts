/**
 * Platform integrations (SMS, payments, AI): which providers exist and which fields each one needs.
 * Pure data shared by the admin form and the server. Keep it free of server-only imports.
 */

export type FieldDef = {
  name: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  help?: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
  optional?: boolean;
  defaultValue?: string;
};

export type ProviderDef = { id: string; name: string; description: string; fields: FieldDef[] };

export type IntegrationKey = "sms" | "ai";

export type IntegrationDef = {
  key: IntegrationKey;
  title: string;
  description: string;
  /** Fields shared by every provider of this integration (stored under `common`). */
  commonFields: FieldDef[];
  providers: ProviderDef[];
  testLabel: string;
  testInput?: FieldDef;
};

export const SMS: IntegrationDef = {
  key: "sms",
  title: "SMS Gateway",
  description: "Used for every church's broadcasts, welcome messages and birthday automation. When off, messages are queued and no credits are charged.",
  commonFields: [
    {
      name: "senderId",
      label: "Default Sender ID",
      defaultValue: "CHURCH_APP",
      help: "Max 11 characters and registered with your provider. Churches with an approved custom ID use theirs.",
    },
  ],
  providers: [
    {
      id: "arkesel",
      name: "Arkesel",
      description: "Ghana bulk SMS. Get an API key from your Arkesel dashboard → SMS API.",
      fields: [{ name: "apiKey", label: "API Key", secret: true }],
    },
    {
      id: "hubtel",
      name: "Hubtel",
      description: "Ghana SMS via Hubtel. Use the Client ID and Client Secret from your Hubtel API keys page.",
      fields: [
        { name: "clientId", label: "Client ID" },
        { name: "clientSecret", label: "Client Secret", secret: true },
      ],
    },
    {
      id: "mnotify",
      name: "mNotify",
      description: "Ghana bulk SMS. Use the API key from your mNotify account → API.",
      fields: [{ name: "apiKey", label: "API Key", secret: true }],
    },
    {
      id: "custom",
      name: "Custom HTTP",
      description:
        "Any provider with an HTTP API. Placeholders: {{to}} (one number), {{to_list}} (JSON array), {{to_csv}}, {{message}}, {{sender}}, {{api_key}}. Values are escaped for the body format.",
      fields: [
        { name: "method", label: "Method", type: "select", options: ["POST", "GET"] },
        { name: "url", label: "Request URL", placeholder: "https://api.provider.com/sms/send?key={{api_key}}" },
        {
          name: "headers",
          label: "Headers (JSON)",
          type: "textarea",
          optional: true,
          placeholder: '{"Authorization": "Bearer {{api_key}}", "Content-Type": "application/json"}',
        },
        {
          name: "body",
          label: "Body template",
          type: "textarea",
          optional: true,
          placeholder: '{"from": "{{sender}}", "to": {{to_list}}, "text": "{{message}}"}',
        },
        {
          name: "mode",
          label: "Recipients per request",
          type: "select",
          options: ["batch", "single"],
          help: "batch: one request with every number. single: one request per number (use {{to}}).",
        },
        { name: "apiKey", label: "API Key (available as {{api_key}})", secret: true, optional: true },
      ],
    },
  ],
  testLabel: "Send Test SMS",
  testInput: { name: "phone", label: "Phone number", placeholder: "024XXXXXXX" },
};

export const AI: IntegrationDef = {
  key: "ai",
  title: "AI Provider",
  description: "Powers Sermon AI, \"Refine with AI\" on announcements and the finance advisor. When off, AI buttons are disabled.",
  commonFields: [],
  providers: [
    {
      id: "gateway",
      name: "Vercel AI Gateway",
      description: "One key for every major model, with usage tracking. Create a key in the Vercel dashboard → AI Gateway.",
      fields: [
        { name: "apiKey", label: "AI Gateway API Key", secret: true },
        { name: "model", label: "Model", defaultValue: "anthropic/claude-sonnet-5", help: "Format provider/model, e.g. anthropic/claude-sonnet-5 or openai/gpt-5." },
      ],
    },
    {
      id: "anthropic",
      name: "Anthropic",
      description: "Claude directly from Anthropic. Create a key at console.anthropic.com.",
      fields: [
        { name: "apiKey", label: "Anthropic API Key", secret: true, placeholder: "sk-ant-…" },
        { name: "model", label: "Model", defaultValue: "claude-sonnet-5" },
      ],
    },
    {
      id: "openai-compatible",
      name: "OpenAI-compatible",
      description: "Any API that speaks the OpenAI chat format: OpenAI, OpenRouter, Groq, Together, or a self-hosted model.",
      fields: [
        { name: "baseUrl", label: "Base URL", placeholder: "https://api.openai.com/v1" },
        { name: "apiKey", label: "API Key", secret: true, optional: true },
        { name: "model", label: "Model", placeholder: "gpt-5" },
      ],
    },
  ],
  testLabel: "Test Prompt",
};

export const INTEGRATIONS: Record<IntegrationKey, IntegrationDef> = { sms: SMS, ai: AI };
