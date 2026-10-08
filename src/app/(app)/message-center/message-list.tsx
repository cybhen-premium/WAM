"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, CheckSquare, Square, MinusSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteMessageLog, deleteMessageLogs } from "./actions";

export interface MessageLogItem {
  id: string;
  churchId: string;
  channel: string;
  kind: string;
  topic: string | null;
  audience: string | null;
  status: string;
  recipients: number;
  body: string;
  creditsUsed: number;
  sentAtFormatted: string;
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  queued: "bg-amber-50 text-amber-700 border border-amber-200/60",
  failed: "bg-red-50 text-red-700 border border-red-200/60",
};

export function MessageList({ logs }: { logs: MessageLogItem[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  // Single delete state
  const [deleteTarget, setDeleteTarget] = useState<MessageLogItem | null>(null);

  // Bulk delete state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const allSelected = logs.length > 0 && selectedIds.length === logs.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(logs.map((l) => l.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSingleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMessageLog(deleteTarget.id);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      router.refresh();
    } catch (err: any) {
      throw new Error(err.message || "Failed to delete message");
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    try {
      await deleteMessageLogs(selectedIds);
      setSelectedIds([]);
      router.refresh();
    } catch (err: any) {
      throw new Error(err.message || "Failed to delete selected messages");
    }
  }

  if (logs.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-black text-slate-800">No History Recorded</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Your SMS logs will appear here
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Top action / selection bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer select-none"
            title={allSelected ? "Deselect all" : "Select all on this page"}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-[#1e3a8a]" />
            ) : someSelected ? (
              <MinusSquare className="h-4 w-4 text-[#1e3a8a]" />
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
            <span>Select All</span>
          </button>
          <span className="text-[11px] font-semibold text-slate-400">
            ({logs.length} on page)
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="text-xs font-extrabold text-[#1e3a8a] bg-blue-50 px-2.5 py-1 rounded-lg">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setBulkDialogOpen(true)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        )}
      </div>

      {/* Message list items */}
      <ul className="divide-y divide-slate-50">
        {logs.map((l) => {
          const isSelected = selectedIds.includes(l.id);
          return (
            <li
              key={l.id}
              className={cn(
                "group px-4 sm:px-6 py-4 transition-colors flex items-start gap-3 sm:gap-4",
                isSelected ? "bg-blue-50/40" : "hover:bg-slate-50/60"
              )}
            >
              {/* Row selection checkbox */}
              <div className="pt-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleSelect(l.id)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={isSelected ? "Deselect message" : "Select message"}
                  aria-label={isSelected ? "Deselect message" : "Select message"}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 text-[#1e3a8a]" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
                  )}
                </button>
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                      STATUS_STYLES[l.status] ?? STATUS_STYLES.queued
                    )}
                  >
                    {l.status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                    {l.kind.replace("_", " ")}
                  </span>
                  {l.kind === "broadcast" && l.topic && (
                    <span className="text-sm font-black text-slate-900 truncate">
                      {l.topic}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-semibold text-slate-400" suppressHydrationWarning>
                    {l.sentAtFormatted}
                  </span>
                </div>

                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600 line-clamp-3">
                  {l.body}
                </p>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  To {l.audience ?? "—"} · {l.recipients} recipient
                  {l.recipients === 1 ? "" : "s"} · {l.creditsUsed} credits
                </p>
              </div>

              {/* Individual delete action */}
              <div className="pt-0.5 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(l)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Single message delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Message Log?"
        description={
          deleteTarget?.topic
            ? `Are you sure you want to delete the broadcast message "${deleteTarget.topic}"? This log will be permanently removed.`
            : "Are you sure you want to permanently delete this SMS message log? This action cannot be undone."
        }
        confirmLabel="Delete Message"
        onConfirm={handleSingleDelete}
        successMessage="Message log deleted successfully"
        errorMessage="Failed to delete message log"
      />

      {/* Bulk messages delete confirmation dialog */}
      <ConfirmDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        title={`Delete ${selectedIds.length} Messages?`}
        description={`Are you sure you want to permanently delete these ${selectedIds.length} SMS message log entries? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.length} Messages`}
        onConfirm={handleBulkDelete}
        successMessage={`${selectedIds.length} message logs deleted successfully`}
        errorMessage="Failed to delete selected message logs"
      />
    </>
  );
}
