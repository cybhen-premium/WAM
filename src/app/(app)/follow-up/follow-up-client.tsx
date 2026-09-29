"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Phone, Plus, Trash2, UserPlus } from "lucide-react";
import { Modal, SelectField, TextAreaField, TextField, buttonStyles } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { addToPipeline, moveStage, removeFromPipeline, updateNotes } from "./actions";

type Stage = "new" | "contacted" | "visited" | "integrated";

export function AddToPipelineButton({ members }: { members: { id: string; fullName: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(addToPipeline, () => setOpen(false));

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonStyles.primary}>
        <Plus /> Add to Pipeline
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add to Pipeline" subtitle="Follow-up" icon={UserPlus}>
        <form action={action} className="space-y-5 text-left">
          {members.length === 0 ? (
            <p className="text-sm text-slate-600">Every visitor is already in the pipeline, or you have no visitors yet.</p>
          ) : (
            <>
              <SelectField
                label="Visitor"
                name="memberId"
                required
                options={[{ value: "", label: "Select visitor..." }, ...members.map((m) => ({ value: m.id, label: m.fullName }))]}
              />
              <TextField label="Assigned To" name="assignedTo" placeholder="e.g. Deacon Mensah" />
              <TextAreaField label="Notes" name="notes" rows={2} />
              {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
              <button type="submit" disabled={pending} className={buttonStyles.submit}>
                {pending ? "Adding…" : "Add to Pipeline"}
              </button>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}

type Entry = {
  id: string;
  fullName: string;
  phone: string | null;
  category: string;
  kind: string;
  notes: string;
  assignedTo: string;
  days: number;
};

export function FollowUpCard({ entry, prev, next }: { entry: Entry; prev: Stage | null; next: Stage | null }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(entry.notes);
  const [assignedTo, setAssignedTo] = useState(entry.assignedTo);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className={`rounded-2xl bg-white p-3 shadow-sm border border-slate-100 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-slate-900 truncate">{entry.fullName}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            {entry.kind === "lost_sheep" ? "Lost sheep" : entry.category} · {entry.days}d in pipeline
          </p>
        </div>
        {entry.phone && (
          <a href={`tel:${entry.phone}`} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1e3a8a]" title={`Call ${entry.phone}`}>
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Assigned to"
            className="w-full rounded-lg bg-slate-50 px-2 h-8 text-xs outline-none"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes"
            className="w-full rounded-lg bg-slate-50 px-2 py-1 text-xs outline-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="text-[10px] font-bold text-slate-400">
              Cancel
            </button>
            <button
              onClick={() =>
                startTransition(async () => {
                  await updateNotes(entry.id, notes, assignedTo);
                  setEditing(false);
                })
              }
              className="rounded-lg bg-[#1e3a8a] px-2.5 h-7 text-[10px] font-black uppercase text-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="mt-2 block w-full text-left text-xs text-slate-500 hover:text-slate-800">
          {entry.assignedTo && <span className="font-bold text-slate-700">→ {entry.assignedTo}. </span>}
          {entry.notes || <span className="italic text-slate-300">Add notes…</span>}
        </button>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          disabled={!prev || pending}
          onClick={() => prev && startTransition(() => moveStage(entry.id, prev))}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:invisible"
          aria-label="Move back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {confirm ? (
          <button
            autoFocus
            onBlur={() => setConfirm(false)}
            onClick={() => startTransition(() => removeFromPipeline(entry.id))}
            className="rounded-lg bg-red-600 px-2 h-7 text-[10px] font-black uppercase text-white"
          >
            Remove
          </button>
        ) : (
          <button onClick={() => setConfirm(true)} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          disabled={!next || pending}
          onClick={() => next && startTransition(() => moveStage(entry.id, next))}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 h-7 text-[10px] font-black uppercase text-slate-600 hover:bg-[#1e3a8a] hover:text-white disabled:invisible"
        >
          {next} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
