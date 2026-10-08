"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/use-form-action";
import {
  CheckCircle2,
  Circle,
  Undo2,
  CalendarDays,
  Search,
  ChevronDown,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  GraduationCap,
} from "lucide-react";
import { Modal, TextField, TextAreaField, buttonStyles } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { completeSobLesson, undoSobLesson, createSobLesson, updateSobLesson, deleteSobLesson } from "./actions";
import { cn } from "@/lib/utils";

export type ClientSobLesson = {
  id: string;
  lessonNumber: number;
  title: string;
  description: string | null;
  isGraduation: boolean;
};

/* Search + Filter toolbar -------------------------------------------------- */

export function SobToolbar({ lessons = [] }: { lessons?: ClientSobLesson[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentFilter = searchParams.get("filter") ?? "all";

  const [q, setQ] = useState(currentQ);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      if (q) p.set("q", q);
      else p.delete("q");
      router.push(`${pathname}?${p.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
  }, [q]);

  const handleFilter = (val: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("filter", val);
    router.push(`${pathname}?${p.toString()}`);
  };

  const filterOptions = [
    { value: "all", label: "All Members" },
    { value: "not_started", label: "Not Started" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed All / Baptized" },
    ...lessons.map((l) => ({
      value: `lesson_${l.lessonNumber}`,
      label: `Lesson ${l.lessonNumber} Done`,
    })),
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      {/* Search */}
      <div className="relative flex-1 w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
        />
      </div>

      {/* Filter dropdown */}
      <div className="relative w-full sm:w-auto">
        <select
          value={currentFilter}
          onChange={(e) => handleFilter(e.target.value)}
          className="h-10 w-full sm:w-auto appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer transition-colors"
        >
          {filterOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

/* Manage Lessons Button & Modals ------------------------------------------- */

export function ManageLessonsButton({ lessons }: { lessons: ClientSobLesson[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 active:scale-[0.98] px-4 h-11 md:h-9 text-xs md:text-[11px] font-black rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm shrink-0 cursor-pointer"
      >
        <BookOpen className="h-4 w-4 text-blue-600" />
        <span>Manage Lessons</span>
        <span className="ml-0.5 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
          {lessons.length}
        </span>
      </button>

      <ManageLessonsModal
        open={open}
        onClose={() => setOpen(false)}
        lessons={lessons}
      />
    </>
  );
}

export function ManageLessonsModal({
  open,
  onClose,
  lessons,
}: {
  open: boolean;
  onClose: () => void;
  lessons: ClientSobLesson[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingLesson, setEditingLesson] = useState<ClientSobLesson | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<ClientSobLesson | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const nextLessonNo =
    lessons.length > 0 ? Math.max(...lessons.map((l) => l.lessonNumber)) + 1 : 1;

  async function handleDelete() {
    if (!deletingLesson) return;
    setDeleteError(null);
    const res = await deleteSobLesson(deletingLesson.id);
    if (res?.error) {
      setDeleteError(res.error);
    } else {
      setDeletingLesson(null);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="SOB Curriculum Lessons"
        subtitle="Manage and organize the School of Baptism lessons"
        icon={BookOpen}
      >
        <div className="space-y-4 text-left">
          <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-500">
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} configured
              </p>
            </div>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-black shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Lesson
            </button>
          </div>

          {deleteError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              {deleteError}
            </div>
          )}

          {lessons.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No lessons configured yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-lg bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2 py-0.5">
                        Lesson {lesson.lessonNumber}
                      </span>
                      <p className="text-sm font-black text-slate-900 truncate">{lesson.title}</p>
                      {lesson.isGraduation && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5">
                          <GraduationCap className="h-3 w-3" /> Graduation Milestone
                        </span>
                      )}
                    </div>
                    {lesson.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{lesson.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => setEditingLesson(lesson)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                      title="Edit lesson"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingLesson(lesson);
                      }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete lesson"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full h-11 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Lesson Modal */}
      <AddLessonModal
        open={adding}
        onClose={() => setAdding(false)}
        nextLessonNo={nextLessonNo}
      />

      {/* Edit Lesson Modal */}
      {editingLesson && (
        <EditLessonModal
          open={!!editingLesson}
          onClose={() => setEditingLesson(null)}
          lesson={editingLesson}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deletingLesson}
        onClose={() => setDeletingLesson(null)}
        title={`Delete Lesson ${deletingLesson?.lessonNumber}`}
        description={`Are you sure you want to delete "${deletingLesson?.title}"? This cannot be undone.`}
        confirmLabel="Delete Lesson"
        successMessage="Lesson deleted."
        errorMessage="Failed to delete lesson."
        onConfirm={handleDelete}
      />
    </>
  );
}

function AddLessonModal({
  open,
  onClose,
  nextLessonNo,
}: {
  open: boolean;
  onClose: () => void;
  nextLessonNo: number;
}) {
  const [state, action, pending] = useFormAction(createSobLesson, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add SOB Lesson"
      subtitle={`Lesson ${nextLessonNo}`}
      icon={Plus}
    >
      <form action={action} className="space-y-4 text-left">
        <TextField
          label="Lesson Title"
          name="title"
          placeholder={`e.g. Lesson ${nextLessonNo} — Christian Living & Prayer`}
          required
        />
        <TextAreaField
          label="Description / Summary (Optional)"
          name="description"
          placeholder="Brief summary or objectives for this lesson..."
          rows={3}
        />
        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
          <input
            type="checkbox"
            name="isGraduation"
            value="true"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <div>
            <p className="text-xs font-black text-slate-800">Graduation / Baptism Milestone</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Completing this lesson marks the member as baptized and graduates them to General Member.
            </p>
          </div>
        </label>

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className={cn(buttonStyles.submit, "flex-1 !h-11 !mt-0")}
          >
            {pending ? "Adding…" : "Add Lesson"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditLessonModal({
  open,
  onClose,
  lesson,
}: {
  open: boolean;
  onClose: () => void;
  lesson: ClientSobLesson;
}) {
  const [state, action, pending] = useFormAction(updateSobLesson, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit SOB Lesson"
      subtitle={`Lesson ${lesson.lessonNumber}`}
      icon={Pencil}
    >
      <form action={action} className="space-y-4 text-left">
        <input type="hidden" name="id" value={lesson.id} />
        <TextField
          label="Lesson Title"
          name="title"
          defaultValue={lesson.title}
          required
        />
        <TextAreaField
          label="Description / Summary (Optional)"
          name="description"
          defaultValue={lesson.description ?? ""}
          rows={3}
        />
        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
          <input
            type="checkbox"
            name="isGraduation"
            value="true"
            defaultChecked={lesson.isGraduation}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <div>
            <p className="text-xs font-black text-slate-800">Graduation / Baptism Milestone</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Completing this lesson marks the member as baptized and graduates them to General Member.
            </p>
          </div>
        </label>

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className={cn(buttonStyles.submit, "flex-1 !h-11 !mt-0")}
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* Member card -------------------------------------------------------------- */

export function SobMemberRow({
  member,
  completedLessons,
  lessons = [],
}: {
  member: { id: string; fullName: string; category: string; baptized: boolean };
  completedLessons: number[];
  lessons?: ClientSobLesson[];
}) {
  const doneSet = new Set(completedLessons);
  const count = completedLessons.length;
  const total = lessons.length;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  const gradLesson = lessons.find((l) => l.isGraduation) ?? (total > 0 ? lessons[total - 1] : null);
  const allDone = (gradLesson && doneSet.has(gradLesson.lessonNumber)) || count >= total;

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{member.fullName}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {member.category}
          </p>
        </div>
        {allDone ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-600 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" /> Baptized
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-600 shrink-0">
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
            className={`h-full rounded-full transition-all duration-500 ${
              allDone ? "bg-emerald-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lesson checklist */}
      <div className="space-y-2">
        {lessons.map((lesson) => (
          <LessonItem
            key={lesson.id}
            memberId={member.id}
            lesson={lesson}
            done={doneSet.has(lesson.lessonNumber)}
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
  lesson: ClientSobLesson;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showDate, setShowDate] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [state, completeAction, completing] = useFormAction(
    completeSobLesson,
    () => setShowDate(false),
  );

  const handleUndo = () => {
    startTransition(() => undoSobLesson(memberId, lesson.lessonNumber));
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        done ? "bg-emerald-50" : "bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-slate-300 shrink-0" />
        )}
        <div className="min-w-0 truncate">
          <span
            className={`text-sm font-bold truncate block ${
              done ? "text-emerald-700" : "text-slate-600"
            }`}
          >
            {lesson.title}
          </span>
          {lesson.isGraduation && (
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block">
              Graduation / Baptism Milestone
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {done ? (
          <button
            onClick={handleUndo}
            disabled={pending}
            title="Undo lesson"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : showDate ? (
          <form action={completeAction} className="flex items-center gap-1.5">
            <input type="hidden" name="memberId" value={memberId} />
            <input type="hidden" name="lesson" value={lesson.lessonNumber} />
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
              className="h-7 px-2.5 text-[10px] font-black uppercase rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {completing ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowDate(false)}
              className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowDate(true)}
            className="h-7 flex items-center gap-1 px-2.5 text-[10px] font-black uppercase rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <CalendarDays className="h-3 w-3" /> Mark Done
          </button>
        )}
      </div>
    </div>
  );
}
