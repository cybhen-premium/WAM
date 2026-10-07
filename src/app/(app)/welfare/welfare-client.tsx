"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Check, MessageSquare, Send } from "lucide-react";
import { useFormAction } from "@/components/use-form-action";
import { reachOut, saveAutomation, scheduleVisit, type FormState } from "./actions";

function Flash({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p className={`text-xs font-bold ${state.error ? "text-red-600" : "text-emerald-600"}`}>{state.error ?? state.message}</p>
  );
}

export function ReachOutAllButton() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={pending}
        onClick={() => startTransition(async () => setState(await reachOut([])))}
        className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-4 h-10 text-xs font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
      >
        <Send className="h-4 w-4" /> {pending ? "Sending…" : "Reach Out All"}
      </button>
      <Flash state={state} />
    </div>
  );
}

export function LostSheepActions({ memberId, scheduled, hasPhone }: { memberId: string; scheduled: boolean; hasPhone: boolean }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>();
  return (
    <div className="flex flex-col items-start sm:items-end gap-1">
      <div className="flex gap-2">
        {hasPhone && (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => setState(await reachOut([memberId])))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 h-9 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <MessageSquare className="h-3.5 w-3.5" /> SMS
          </button>
        )}
        {scheduled ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 h-9 text-[11px] font-bold text-emerald-700">
            <Check className="h-3.5 w-3.5" /> Visit scheduled
          </span>
        ) : (
          <button
            disabled={pending}
            onClick={() => startTransition(() => scheduleVisit(memberId))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-3 h-9 text-[11px] font-bold text-white hover:bg-blue-900"
          >
            <CalendarCheck className="h-3.5 w-3.5" /> Schedule Visit
          </button>
        )}
      </div>
      <Flash state={state} />
    </div>
  );
}

export function AutomationForm(props: {
  enabled: boolean;
  birthdayTemplate: string;
  anniversaryTemplate: string;
  absenceTemplate: string;
  smsReady: boolean;
}) {
  const [state, action, pending] = useFormAction(saveAutomation);
  const [enabled, setEnabled] = useState(props.enabled);

  return (
    <form action={action} className="rounded-[2rem] bg-white p-6 md:p-8 shadow-xl shadow-slate-200/60 space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">AI Delivery Engine</h2>
          <p className="text-sm text-slate-500">Automatically dispatches daily celebrations & Sunday absentee care messages.</p>
          {!props.smsReady && (
            <p className="mt-1 text-xs font-bold text-amber-600">No SMS provider configured yet: messages will be logged as queued.</p>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${enabled ? "text-emerald-600" : "text-slate-400"}`}>
            {enabled ? "Active" : "Paused"}
          </span>
          <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="peer sr-only" />
          <span className="relative h-7 w-12 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

      {(["birthday", "anniversary"] as const).map((k) => (
        <div key={k}>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={`${k}Template`} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {k} Template
            </label>
            <span className="text-[10px] font-bold text-slate-400">Use tag: [Name]</span>
          </div>
          <textarea
            id={`${k}Template`}
            name={`${k}Template`}
            defaultValue={k === "birthday" ? props.birthdayTemplate : props.anniversaryTemplate}
            rows={3}
            required
            className="w-full rounded-2xl bg-slate-50 p-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
          />
        </div>
      ))}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="absenceTemplate" className="text-[10px] font-black uppercase tracking-widest text-blue-600">
            Sunday Absentee Warm Message Template
          </label>
          <span className="text-[10px] font-bold text-slate-400">Use tag: [Name]</span>
        </div>
        <textarea
          id="absenceTemplate"
          name="absenceTemplate"
          defaultValue={props.absenceTemplate}
          rows={3}
          required
          className="w-full rounded-2xl bg-blue-50/40 border border-blue-100 p-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Automatically sent to members who did not come to church when department leads take Sunday attendance.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="h-12 rounded-2xl bg-[#1e3a8a] px-8 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-900 disabled:opacity-60">
          {pending ? "Saving…" : "Save Configuration"}
        </button>
        <Flash state={state} />
      </div>
    </form>
  );
}
