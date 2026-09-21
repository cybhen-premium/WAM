"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/components/use-form-action";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { Modal, SelectField, TextAreaField, TextField, buttonStyles } from "@/components/ui";
import { EVENT_TYPES } from "@/lib/constants";
import { createEvent, deleteEvent } from "./actions";

export function NewEventButton({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(createEvent, () => setOpen(false));

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${buttonStyles.primary} h-11 md:h-11 px-5 text-xs`}>
        <Plus /> New Event
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create New Event" subtitle="Church Calendar" icon={CalendarPlus}>
        <form action={action} className="space-y-5 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField className="sm:col-span-2" label="Event Title" name="title" required placeholder="e.g. Sunday Celebration Service" />
            <SelectField label="Type" name="type" options={EVENT_TYPES} defaultValue="Service" />
            <TextField label="Date" name="date" type="date" required defaultValue={defaultDate} />
            <TextField label="Start Time" name="start" type="time" />
            <TextField label="End Time" name="end" type="time" />
            <TextField className="sm:col-span-2" label="Location" name="location" placeholder="e.g. Main Sanctuary" />
            <TextAreaField className="sm:col-span-2" label="Notes" name="notes" placeholder="Extra details..." rows={3} />
          </div>
          {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending} className={buttonStyles.submit}>
            {pending ? "Scheduling…" : "Schedule Event"}
          </button>
        </form>
      </Modal>
    </>
  );
}

export function DeleteEventButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  return confirm ? (
    <button
      autoFocus
      disabled={pending}
      onBlur={() => setConfirm(false)}
      onClick={() => startTransition(() => deleteEvent(id))}
      className="h-8 shrink-0 rounded-lg bg-red-600 px-2 text-[10px] font-black uppercase text-white"
    >
      Confirm
    </button>
  ) : (
    <button
      onClick={() => setConfirm(true)}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600"
      aria-label="Delete event"
      title="Delete event"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
