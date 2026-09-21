"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, MessageSquareText, Radio, Sparkles, Wallet, Zap } from "lucide-react";
import { useFormAction } from "@/components/use-form-action";
import { cn } from "@/lib/utils";
import { INTEGRATIONS, type FieldDef, type IntegrationKey } from "@/lib/integrations";
import type { AdminView } from "@/lib/platform";
import { saveIntegrationSettings, testIntegration, type IntegrationState } from "./integration-actions";

const ICONS = { sms: MessageSquareText, payments: Wallet, ai: Sparkles } as const;

const label = "mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400";
const field =
  "w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-100";

function Flash({ state }: { state: IntegrationState }) {
  if (!state) return null;
  return <p className={cn("text-sm font-bold break-words", state.error ? "text-red-600" : "text-emerald-600")}>{state.error ?? state.message}</p>;
}

function Field({ f, name, defaultValue, secretSaved }: { f: FieldDef; name: string; defaultValue: string; secretSaved: boolean }) {
  const common = {
    name,
    defaultValue,
    placeholder: secretSaved ? "Saved. Leave blank to keep" : f.placeholder,
  };
  return (
    <label className={cn("block", f.type === "textarea" && "sm:col-span-2")}>
      <span className={label}>
        {f.secret && <KeyRound className="h-3 w-3" />} {f.label}
        {f.optional && <span className="font-semibold normal-case tracking-normal text-slate-300">(optional)</span>}
      </span>
      {f.type === "textarea" ? (
        <textarea {...common} rows={4} spellCheck={false} className={cn(field, "py-2 font-mono text-xs")} />
      ) : f.type === "select" ? (
        <select {...common} defaultValue={defaultValue || f.options?.[0]} className={cn(field, "h-11")}>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={f.secret ? "password" : "text"}
          autoComplete="off"
          required={!f.optional && !secretSaved}
          className={cn(field, "h-11", f.secret && "font-mono")}
        />
      )}
      {f.help && <span className="mt-1 block text-xs text-slate-400">{f.help}</span>}
    </label>
  );
}

export function IntegrationForm({ kind, saved }: { kind: IntegrationKey; saved: AdminView }) {
  const integration = INTEGRATIONS[kind];
  const Icon = ICONS[kind];
  const [provider, setProvider] = useState(saved?.provider ?? integration.providers[0].id);
  const [state, action, pending] = useFormAction(saveIntegrationSettings.bind(null, kind));
  const [testState, testAction, testing] = useFormAction(testIntegration.bind(null, kind));
  const def = integration.providers.find((p) => p.id === provider)!;
  const sameAsSaved = saved?.provider === provider;
  const liveName = integration.providers.find((p) => p.id === saved?.provider)?.name;

  return (
    <section className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-slate-100">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1e3a8a]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">{integration.title}</h2>
            <p className="max-w-2xl text-sm text-slate-500">{integration.description}</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
            saved?.enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
          )}
        >
          <Radio className="h-3.5 w-3.5" />
          {saved?.enabled ? `Live · ${liveName}` : saved ? "Saved but off" : "Not set up"}
        </span>
      </div>

      <form action={action} className="space-y-6">
        <div>
          <span className={label}>Provider</span>
          <div className={cn("grid gap-2", integration.providers.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
            {integration.providers.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-3 h-11 text-sm font-bold transition-colors",
                  provider === p.id ? "border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} className="sr-only" />
                {provider === p.id && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{def.description}</p>
        </div>

        {integration.commonFields.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {integration.commonFields.map((f) => (
              <Field key={f.name} f={f} name={`common_${f.name}`} defaultValue={saved?.common[f.name] ?? f.defaultValue ?? ""} secretSaved={false} />
            ))}
          </div>
        )}

        {/* Remount on provider change so defaults reset. */}
        <div key={provider} className="grid gap-4 sm:grid-cols-2">
          {def.fields.map((f) => (
            <Field
              key={f.name}
              f={f}
              name={`field_${f.name}`}
              defaultValue={f.secret ? "" : sameAsSaved ? (saved?.values[f.name] ?? f.defaultValue ?? "") : (f.defaultValue ?? "")}
              secretSaved={!!f.secret && sameAsSaved && !!saved?.savedSecrets.includes(f.name)}
            />
          ))}
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
          <span className="text-sm font-bold text-slate-800">Enabled</span>
          <input type="checkbox" name="enabled" defaultChecked={saved?.enabled ?? true} className="peer sr-only" />
          <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className="h-11 rounded-xl bg-[#1e3a8a] px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-900 disabled:opacity-60">
            {pending ? "Saving…" : `Save ${integration.title}`}
          </button>
          <Flash state={state} />
        </div>
      </form>

      <form action={testAction} className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
        {integration.testInput && (
          <input
            name={integration.testInput.name}
            type="tel"
            required
            placeholder={integration.testInput.placeholder}
            aria-label={integration.testInput.label}
            className={cn(field, "h-11 sm:w-56")}
          />
        )}
        <button
          type="submit"
          disabled={testing || !saved?.enabled}
          title={saved?.enabled ? undefined : "Save and enable first"}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <Zap className="h-4 w-4" /> {testing ? "Testing…" : integration.testLabel}
        </button>
        <Flash state={testState} />
      </form>
    </section>
  );
}
