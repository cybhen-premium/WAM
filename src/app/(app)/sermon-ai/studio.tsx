"use client";

import { useMemo, useState, useTransition } from "react";
import Markdown from "react-markdown";
import { BookOpen, BrainCircuit, History, MessageSquare, Save, Search, Sparkles, Trash2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteDraft, draftSermon, generatePlan, saveDraft, summarize } from "./actions";

type Draft = { id: string; title: string; kind: string; topic: string; scripture: string; content: string; createdAt: string };
type Doc = { id?: string; title: string; kind: string; topic: string; scripture: string; content: string };

const input =
  "h-11 w-full rounded-xl bg-slate-50 px-4 text-sm font-semibold outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-100";

export function SermonStudio({ credits, aiReady, drafts }: { credits: number; aiReady: boolean; drafts: Draft[] }) {
  const [tab, setTab] = useState<"planner" | "writer">("planner");
  const [planMode, setPlanMode] = useState<"calendar" | "series">("calendar");
  const [days, setDays] = useState(30);
  const [theme, setTheme] = useState("");
  const [topic, setTopic] = useState("");
  const [scripture, setScripture] = useState("");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [view, setView] = useState<"preview" | "edit">("preview");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const library = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? drafts.filter((d) => d.title.toLowerCase().includes(t) || d.topic.toLowerCase().includes(t)) : drafts;
  }, [q, drafts]);

  function run(fn: () => Promise<{ text?: string; error?: string }>, onText: (text: string) => void) {
    setError(null);
    setSavedNote(null);
    startTransition(async () => {
      const r = await fn();
      if (r.text) onText(r.text);
      else setError(r.error ?? "Something went wrong.");
    });
  }

  function save() {
    if (!doc) return;
    startTransition(async () => {
      const r = await saveDraft(doc);
      if (r.error || !r.id) setError(r.error ?? "Could not save.");
      else {
        setDoc({ ...doc, id: r.id, title: r.title ?? doc.title });
        setSavedNote("Saved to library");
      }
    });
  }

  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl md:text-4xl font-black text-[#1e3a8a] tracking-tight">
            <BrainCircuit className="h-8 w-8" /> Sermon AI
          </h1>
          <p className="text-sm text-slate-500">Theological intelligence for your ministry</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-2 shadow-sm">
          <Wallet className="h-5 w-5 text-amber-500" />
          <div className="leading-none">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Credits</p>
            <p className="text-lg font-black text-[#1e3a8a]">{credits}</p>
          </div>
        </div>
      </div>

      {!aiReady && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          AI isn&apos;t set up yet. A platform admin can enable it in Settings → Integrations. Saving and editing drafts works now.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <div className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200/60 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {(["planner", "writer"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "h-9 rounded-lg text-[11px] font-black uppercase tracking-widest",
                    tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "planner" ? (
              <>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-50 p-1">
                  {(["calendar", "series"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPlanMode(m)}
                      className={cn(
                        "h-8 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        planMode === m ? "bg-[#1e3a8a] text-white" : "text-slate-500",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">Days to Plan</span>
                  <input type="number" min={7} max={84} step={7} value={days} onChange={(e) => setDays(Number(e.target.value))} className={input} />
                </label>
                <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Theme (optional), e.g. Faith in hard times" className={input} />
                <button
                  disabled={pending || !aiReady}
                  onClick={() =>
                    run(
                      () => generatePlan(planMode, days, theme),
                      (text) => {
                        setDoc({ title: "", kind: planMode === "series" ? "series" : "plan", topic: theme, scripture: "", content: text });
                        setView("preview");
                      },
                    )
                  }
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1e3a8a] text-sm font-black text-white shadow-lg hover:bg-blue-900 disabled:bg-blue-300"
                >
                  <Sparkles className="h-4 w-4" /> {pending ? "Thinking…" : "Generate Plan"}
                </button>
                <p className="text-center text-[10px] font-bold text-slate-400">Costs 2 credits</p>
              </>
            ) : (
              <>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sermon Topic" className={input} />
                <input value={scripture} onChange={(e) => setScripture(e.target.value)} placeholder="Scripture" className={input} />
                <button
                  disabled={pending || !aiReady || !topic.trim()}
                  onClick={() =>
                    run(
                      () => draftSermon(topic, scripture),
                      (text) => {
                        setDoc({ title: "", kind: "sermon", topic, scripture, content: text });
                        setView("preview");
                      },
                    )
                  }
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1e3a8a] text-sm font-black text-white shadow-lg hover:bg-blue-900 disabled:bg-blue-300"
                >
                  {pending ? "Drafting…" : "Draft Full Sermon"}
                </button>
                <p className="text-center text-[10px] font-bold text-slate-400">Costs 3 credits</p>
              </>
            )}
            <button
              onClick={() => {
                setDoc({ title: "", kind: "sermon", topic: "", scripture: "", content: "" });
                setView("edit");
              }}
              className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-700"
            >
              or start a blank draft
            </button>
          </div>

          <div className="rounded-[2rem] bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
            <div className="p-5 pb-3 space-y-3">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <History className="h-3.5 w-3.5" /> Library
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search saved drafts..." className="h-9 w-full rounded-xl bg-slate-50 pl-9 text-xs outline-none" />
              </div>
            </div>
            <ul className="max-h-80 overflow-y-auto border-t border-slate-100">
              {library.length === 0 ? (
                <li className="px-5 py-8 text-center text-xs text-slate-400">No saved drafts yet</li>
              ) : (
                library.map((d) => (
                  <li key={d.id} className={cn("group flex items-center gap-2 px-5 py-3 hover:bg-slate-50", doc?.id === d.id && "bg-blue-50/60")}>
                    <button
                      onClick={() => {
                        setDoc({ id: d.id, title: d.title, kind: d.kind, topic: d.topic, scripture: d.scripture, content: d.content });
                        setView("preview");
                        setSavedNote(null);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-bold text-slate-800">{d.title}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {d.kind} · {new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        if (doc?.id === d.id) setDoc(null);
                        startTransition(() => deleteDraft(d.id));
                      }}
                      className="rounded-lg p-1.5 text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                      aria-label={`Delete ${d.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white shadow-xl shadow-slate-200/60 min-h-[600px] flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {(["preview", "edit"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  disabled={!doc}
                  className={cn("h-8 rounded-lg px-4 text-xs font-bold capitalize", view === v ? "bg-blue-100 text-[#1e3a8a]" : "text-slate-500")}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {savedNote && <span className="text-xs font-bold text-emerald-600">{savedNote}</span>}
              <button
                disabled={!doc?.content || pending || !aiReady}
                onClick={() =>
                  run(
                    () => summarize(doc!.content),
                    (text) => setDoc((d) => (d ? { ...d, content: `${d.content}\n\n---\n\n## Summary\n\n${text}` } : d)),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 px-3 h-9 text-[11px] font-bold text-orange-600 hover:bg-orange-50 disabled:opacity-40"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Draft Summary
              </button>
              <button
                disabled={!doc?.content || pending}
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 h-9 text-[11px] font-black text-white hover:bg-emerald-600 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>

          {error && <p className="mx-4 mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</p>}

          {!doc ? (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-300">
              <BookOpen className="h-16 w-16 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">{pending ? "Generating…" : "Select a topic to begin your study"}</p>
            </div>
          ) : view === "edit" ? (
            <div className="flex flex-1 flex-col gap-3 p-4">
              <input
                value={doc.title}
                onChange={(e) => setDoc({ ...doc, title: e.target.value })}
                placeholder="Title (defaults to the first heading)"
                className={input}
              />
              <textarea
                value={doc.content}
                onChange={(e) => setDoc({ ...doc, content: e.target.value })}
                className="flex-1 min-h-[480px] w-full rounded-2xl bg-slate-50 p-4 font-mono text-sm outline-none"
                placeholder="Write in Markdown…"
              />
            </div>
          ) : (
            <article className="prose-sermon flex-1 overflow-y-auto p-6 md:p-8">
              <Markdown>{doc.content || "_Empty draft_"}</Markdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
