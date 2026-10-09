"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Check, MessageSquare, Send } from "lucide-react";
import { useFormAction } from "@/components/use-form-action";
import { cn } from "@/lib/utils";
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

export type InquiryItem = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  reply: string | null;
  repliedBy: string | null;
  repliedAt: Date | null;
  createdAt: Date;
  member: {
    id: string;
    fullName: string;
    memberIdCode: string | null;
    photoUrl: string | null;
    phone: string | null;
    category: string;
  };
};

export function InquiriesPanel({ inquiries }: { inquiries: InquiryItem[] }) {
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");
  const filtered = inquiries.filter((inq) => {
    if (filter === "pending") return inq.status !== "resolved";
    if (filter === "resolved") return inq.status === "resolved";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Member Inquiries &amp; Complaints ({inquiries.length})
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Review and respond to messages, complaints, and pastoral care inquiries submitted through the Member Portal.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              filter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            All ({inquiries.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              filter === "pending" ? "bg-white text-amber-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            Pending ({inquiries.filter((i) => i.status !== "resolved").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("resolved")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              filter === "resolved" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            Resolved ({inquiries.filter((i) => i.status === "resolved").length})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center border border-slate-100 shadow-sm">
          <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No member inquiries found</p>
          <p className="text-xs text-slate-400 mt-1">
            When members submit complaints or questions via their portal, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inq) => (
            <InquiryCard key={inq.id} inquiry={inq} />
          ))}
        </div>
      )}
    </div>
  );
}

function InquiryCard({ inquiry }: { inquiry: InquiryItem }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pending, startTransition] = useTransition();

  async function handleSendReply() {
    if (!replyText.trim()) return;
    startTransition(async () => {
      const { replyMemberInquiry } = await import("./actions");
      const res = await replyMemberInquiry(inquiry.id, replyText);
      if (!res.ok) {
        alert(res.error || "Failed to send reply");
        return;
      }
      setReplyOpen(false);
      setReplyText("");
    });
  }

  return (
    <div className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-100 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {inquiry.member.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={inquiry.member.photoUrl}
              alt={inquiry.member.fullName}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
              {inquiry.member.fullName.charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-slate-900">{inquiry.member.fullName}</p>
              {inquiry.member.memberIdCode && (
                <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                  {inquiry.member.memberIdCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>{inquiry.member.category}</span>
              {inquiry.member.phone && (
                <>
                  <span>•</span>
                  <a href={`tel:${inquiry.member.phone}`} className="text-blue-600 hover:underline font-semibold">
                    {inquiry.member.phone}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
              inquiry.status === "resolved"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                : "bg-amber-50 text-amber-700 border border-amber-200/80"
            )}
          >
            {inquiry.status === "resolved" ? "Resolved" : "Pending Action"}
          </span>
          <span className="text-xs text-slate-400">
            {new Date(inquiry.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      <div>
        <div className="inline-block px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider mb-1.5">
          {inquiry.category}
        </div>
        <h3 className="text-base font-black text-slate-900">{inquiry.subject}</h3>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
          {inquiry.message}
        </p>
      </div>

      {/* Existing Reply */}
      {inquiry.reply && (
        <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/60 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-black text-blue-900 uppercase tracking-wider">
            <span>Pastoral Reply ({inquiry.repliedBy || "Pastor"}):</span>
            {inquiry.repliedAt && (
              <span className="text-[10px] text-blue-600 font-semibold lowercase">
                {new Date(inquiry.repliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
            {inquiry.reply}
          </p>
        </div>
      )}

      {/* Action to Reply or Update */}
      <div className="pt-1 flex items-center justify-between">
        {!replyOpen ? (
          <button
            type="button"
            onClick={() => setReplyOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-colors cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{inquiry.reply ? "Update Pastoral Reply" : "Reply to Member"}</span>
          </button>
        ) : (
          <div className="w-full space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Write Pastoral Reply (Sent to Member Portal):
            </p>
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response to the member here..."
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending || !replyText.trim()}
                onClick={handleSendReply}
                className="h-9 px-4 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-black transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{pending ? "Sending..." : "Send Pastoral Reply & Resolve"}</span>
              </button>
              <button
                type="button"
                onClick={() => setReplyOpen(false)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
