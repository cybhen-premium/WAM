"use client";

import { useState, useTransition } from "react";
import { Megaphone, Send, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { refineMessage, sendAnnouncement, type RefineStyle } from "./actions";

type Audience = { value: string; label: string; count: number };

export function Composer({ credits, audiences }: { credits: number; audiences: Audience[] }) {
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState(audiences[0]?.value ?? "all");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiPending, startAi] = useTransition();
  const [sendPending, startSend] = useTransition();
  const selected = audiences.find((a) => a.value === audience);
  const segments = Math.max(1, Math.ceil(body.length / 160));

  function refine(style: RefineStyle) {
    setFlash(null);
    startAi(async () => {
      const r = await refineMessage(style, topic, body);
      if (r.text) setBody(r.text);
      else setFlash({ ok: false, text: r.error ?? "AI failed." });
    });
  }

  function send() {
    setFlash(null);
    startSend(async () => {
      const r = await sendAnnouncement(topic, body, audience, selected?.label ?? audience);
      if ("ok" in r && r.ok) {
        setFlash({ ok: true, text: r.message });
        setBody("");
        setTopic("");
      } else setFlash({ ok: false, text: r.error ?? "Send failed." });
    });
  }

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#1e3a8a]">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Announcements</h1>
          <p className="text-sm text-slate-500">Broadcast instant updates to your congregation.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm space-y-6">
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Broadcast Topic</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Sunday Service Reminder"
              className="h-12 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message Body</span>
              <button
                onClick={() => refine("refine")}
                disabled={aiPending}
                className="inline-flex items-center gap-1 text-[11px] font-black text-[#1e3a8a] hover:underline disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> {aiPending ? "Refining…" : "Refine with AI"}
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder="Enter message details or rough notes for AI to polish..."
              className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {(["polish", "spiritual", "shorten"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => refine(s)}
                    disabled={aiPending}
                    className="rounded-lg border border-slate-200 px-3 h-7 text-[10px] font-bold capitalize text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {body.length} chars · {segments} SMS
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {flash ? (
              <p className={cn("text-sm font-semibold", flash.ok ? "text-emerald-600" : "text-red-600")}>{flash.text}</p>
            ) : (
              <p className="text-xs text-slate-400">
                {selected ? `${selected.count} recipients` : ""}
              </p>
            )}
            <button
              onClick={send}
              disabled={sendPending || !body.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-6 h-12 text-sm font-black text-white hover:bg-blue-900 disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" /> {sendPending ? "Sending…" : "Send via SMS"}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-5 shadow-sm self-start">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <Users className="h-3.5 w-3.5" /> Target Audience
          </p>
          <div className="space-y-1.5">
            {audiences.map((a) => (
              <button
                key={a.value}
                onClick={() => setAudience(a.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 h-10 text-xs font-bold transition-colors",
                  audience === a.value ? "bg-blue-50 text-[#1e3a8a]" : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className="truncate">{a.label}</span>
                <span className="text-[10px] text-slate-400">{a.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
