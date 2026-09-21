"use client";

import { useActionState } from "react";
import { Church, Gift, KeyRound, MapPin, Phone, User } from "lucide-react";
import { Field, SubmitButton } from "@/components/auth-card";
import { createChurch } from "./actions";

export function SetupForm({ referralCode }: { referralCode: string }) {
  const [state, action, pending] = useActionState(createChurch, undefined);

  return (
    <form action={action} className="space-y-5">
      <Field label="Church Name *" name="name" required placeholder="e.g., Grace Community Church" icon={<Church />} />
      <Field label="Pastor's Name" name="pastorName" placeholder="e.g., Pastor John Smith" icon={<User />} />
      <Field label="Official Phone Number" name="phone" type="tel" placeholder="+233..." icon={<Phone />} />
      <Field label="City / Location" name="location" placeholder="e.g., Accra, Ghana" icon={<MapPin />} />

      <div className="border-t border-slate-100 pt-5">
        <span className="mb-2 block px-1 text-[10px] font-extrabold uppercase tracking-tight text-emerald-600">
          Denomination Invite Code
        </span>
        <label className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 h-12">
          <KeyRound className="h-4 w-4 text-emerald-500" />
          <input
            name="denominationCode"
            placeholder="Optional: join your denomination network"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-emerald-700/40 outline-none"
          />
        </label>
      </div>

      <Field label="Referral Code (optional)" name="referralCode" defaultValue={referralCode} placeholder="From a fellow pastor" icon={<Gift />} />

      {state?.error && <p className="text-sm font-semibold text-destructive">{state.error}</p>}
      <SubmitButton pending={pending}>Create My Church</SubmitButton>
    </form>
  );
}
