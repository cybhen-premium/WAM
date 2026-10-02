"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { useSetUrlParam } from "@/components/use-url-param";
import { ConfirmDialog } from "@/components/confirm-dialog";

/** Debounced search input bound to the ?q= URL param. */
export function SearchBox({ placeholder, initial }: { placeholder: string; initial: string }) {
  const [setParam] = useSetUrlParam();
  const [q, setQ] = useState(initial);

  useEffect(() => {
    if (q === initial) return;
    const t = setTimeout(() => setParam("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 h-10 rounded-xl bg-white border border-slate-200 text-xs font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
      />
    </div>
  );
}

/** Trash icon that opens a confirmation dialog before executing the action. */
export function DeleteButton({
  action,
  title = "Permanently Delete?",
  description = "This action cannot be undone.",
  confirmLabel = "Permanently Delete",
  successMessage = "Deleted successfully!",
  errorMessage = "Failed to delete.",
}: {
  action: () => Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  successMessage?: string;
  errorMessage?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
        title="Delete"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onConfirm={action}
        successMessage={successMessage}
        errorMessage={errorMessage}
      />
    </>
  );
}
