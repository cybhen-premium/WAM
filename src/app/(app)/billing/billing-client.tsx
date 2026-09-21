"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buyPlan, buyTopup } from "./actions";

type Plan = { id: string; name: string; tagline: string; monthly: number; credits: number; features: string[]; popular?: boolean };

export function PlanGrid({ plans, current, supportEmail }: { plans: Plan[]; current: string; supportEmail?: string }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="space-y-5">
      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl bg-slate-100 p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 h-10 text-xs font-black uppercase tracking-widest",
                cycle === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
              )}
            >
              {c}
              {c === "yearly" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] text-emerald-700">2 months free</span>}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-center text-sm font-bold text-red-600">{error}</p>}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const isCurrent = p.id === current;
          const price = cycle === "yearly" ? p.monthly * 10 : p.monthly;
          return (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-[2rem] bg-white p-6 shadow-sm border",
                p.popular ? "border-[#1e3a8a] shadow-xl shadow-blue-100" : "border-slate-100",
                isCurrent && "ring-2 ring-amber-400",
              )}
            >
              {(p.popular || isCurrent) && (
                <span
                  className={cn(
                    "absolute -top-3 left-6 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest",
                    isCurrent ? "bg-amber-400 text-slate-900" : "bg-[#1e3a8a] text-white",
                  )}
                >
                  {isCurrent ? "Current Plan" : "Most Popular"}
                </span>
              )}
              <p className="text-lg font-black uppercase text-slate-900">{p.name}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{p.tagline}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-xs font-bold text-slate-400">GHS</span>
                <span className="text-4xl font-black text-slate-900">{price.toLocaleString()}</span>
                <span className="text-xs font-bold text-slate-400">/{cycle === "yearly" ? "yr" : "mo"}</span>
              </p>
              <p className="mt-2 inline-flex self-start rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-black text-[#1e3a8a]">
                {p.credits} Messaging Credits
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={pending || isCurrent}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const r = await buyPlan(p.id, cycle);
                    if (r?.error) setError(r.error);
                  })
                }
                className={cn(
                  "mt-6 h-12 rounded-2xl text-xs font-black uppercase tracking-widest",
                  isCurrent ? "bg-slate-100 text-slate-500" : "bg-[#1e3a8a] text-white hover:bg-blue-900",
                )}
              >
                {isCurrent ? "Active Plan" : pending ? "Redirecting…" : "Activate Plan"}
              </button>
            </div>
          );
        })}

        <div className="flex flex-col rounded-[2rem] bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-lg font-black uppercase">Enterprise</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">For denominational HQ</p>
          <p className="mt-4 text-4xl font-black">Custom</p>
          <ul className="mt-4 flex-1 space-y-2">
            {["Denominational OS Architecture", "Hierarchical Branch Management", "Global Roll-up Analytics", "Automated License Distribution", "Dedicated Enterprise Support"].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> {f}
              </li>
            ))}
          </ul>
          <a
            href={supportEmail ? `mailto:${supportEmail}?subject=Enterprise%20plan` : undefined}
            aria-disabled={!supportEmail}
            className={cn(
              "mt-6 flex h-12 items-center justify-center rounded-2xl bg-amber-500 text-xs font-black uppercase tracking-widest text-slate-900 hover:bg-amber-400",
              !supportEmail && "pointer-events-none opacity-50",
            )}
          >
            Contact Support
          </a>
        </div>
      </div>
    </section>
  );
}

export function TopupButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await buyTopup(id);
            if (r?.error) setError(r.error);
          })
        }
        className="mt-4 h-10 w-full rounded-xl bg-amber-500 text-xs font-black text-slate-900 hover:bg-amber-400 disabled:opacity-60"
      >
        {pending ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
    </>
  );
}
