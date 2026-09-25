"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/components/use-form-action";
import { CheckCircle2, Circle, Undo2, CalendarDays } from "lucide-react";
import { completeSobLesson, undoSobLesson } from "./actions";

const LESSONS = [
  { no: 1, title: "Lesson 1 — The Fall of Man & Redemption Plan" },
  { no: 2, title: "Lesson 2 — Water Baptism" },
  { no: 3, title: "Lesson 3 — Holy Spirit Baptism" },
];

export function SobMemberRow({
  member,
  completedLessons,
}: {
  member: { id: string; fullName: string; category: string; baptized: boolean };
  completedLessons: number[];
}) {
  const doneSet = new Set(completedLessons);
  const count = completedLessons.length;
  const total = 3;
  const pct = Math.round((count / total) * 100);
  const allDone = count === total;

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{member.fullName}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{member.category}</p>
        </div>
        {allDone ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Baptized
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-600">
            {count}/{total} Lessons
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lesson checklist */}
      <div className="space-y-2">
        {LESSONS.map((lesson) => (
          <LessonItem
            key={lesson.no}
            memberId={member.id}
            lesson={lesson}
            done={doneSet.has(lesson.no)}
          />
        ))}
      </div>
    </div>
  );
}

function LessonItem({
  memberId,
  lesson,
  done,
}: {
  memberId: string;
  lesson: { no: number; title: string };
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showDate, setShowDate] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [state, completeAction, completing] = useFormAction(completeSobLesson, () => setShowDate(false));

  const handleUndo = () => {
    startTransition(() => undoSobLesson(memberId, lesson.no));
  };

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors ${done ? "bg-emerald-50" : "bg-slate-50"}`}>
      <div className="flex items-center gap-2.5">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-slate-300 shrink-0" />
        )}
        <span className={`text-sm font-bold ${done ? "text-emerald-700" : "text-slate-600"}`}>
          {lesson.title}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {done ? (
          <button
            onClick={handleUndo}
            disabled={pending}
            title="Undo lesson"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : showDate ? (
          <form action={completeAction} className="flex items-center gap-1.5">
            <input type="hidden" name="memberId" value={memberId} />
            <input type="hidden" name="lesson" value={lesson.no} />
            <input
              type="date"
              name="date"
              defaultValue={today}
              required
              className="h-7 text-xs rounded-lg border border-slate-200 px-2 outline-none focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={completing}
              className="h-7 px-2.5 text-[10px] font-black uppercase rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {completing ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowDate(false)}
              className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowDate(true)}
            className="h-7 flex items-center gap-1 px-2.5 text-[10px] font-black uppercase rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            <CalendarDays className="h-3 w-3" /> Mark Done
          </button>
        )}
      </div>
    </div>
  );
}
