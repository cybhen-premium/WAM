"use client";

import { useTransition } from "react";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  successMessage?: string;
  errorMessage?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  successMessage = "Done!",
  errorMessage = "Something went wrong.",
}: ConfirmDialogProps) {
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onConfirm();
        toast.success(successMessage);
        onClose();
      } catch {
        toast.error(errorMessage);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={pending}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Body */}
        <div className="px-5 sm:px-8 pt-8 sm:pt-10 pb-6 sm:pb-8 text-center">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>

          {/* Description */}
          <p className="mt-3 text-sm leading-relaxed text-slate-500">{description}</p>

          {/* Buttons */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              disabled={pending}
              className="h-12 rounded-2xl bg-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={pending}
              className="h-12 rounded-2xl bg-red-600 text-sm font-extrabold text-white shadow-lg shadow-red-200 hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {pending ? "Please wait…" : confirmLabel}
            </button>
          </div>
        </div>

        {/* Footer strip */}
        <div className="border-t border-red-100 bg-red-50 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">
            Critical Action Required
          </p>
        </div>
      </div>
    </div>
  );
}
