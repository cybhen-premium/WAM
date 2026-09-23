"use client";

import { useEffect } from "react";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Buttons ------------------------------------------------------------------ */

const BTN =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]";

export const buttonStyles = {
  outline: cn(BTN, "border border-slate-200 bg-white hover:bg-slate-50 px-3 h-10 md:h-9 text-[11px] font-bold rounded-xl"),
  primary: cn(BTN, "px-4 h-11 md:h-9 text-xs md:text-[11px] font-black rounded-xl bg-[#1e3a8a] text-white hover:bg-blue-900 shadow-md"),
  submit: cn(BTN, "w-full h-12 md:h-14 rounded-2xl bg-[#1e3a8a] text-white hover:bg-blue-900 text-xs font-black uppercase tracking-widest shadow-lg"),
  ghost: cn(BTN, "h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"),
};

/* Modal -------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  wide,
  compact,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  wide?: boolean;
  compact?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/80 animate-in fade-in-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-[95vw] overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-white shadow-2xl animate-in fade-in-0 zoom-in-95",
          wide ? "sm:max-w-[800px]" : compact ? "sm:max-w-[360px]" : "sm:max-w-[600px]",
        )}
      >
        <div className="relative p-5 md:p-6 pb-4 bg-[#1e3a8a] text-white">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-white/10 rounded-xl">
                <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
            )}
            <div>
              <h2 className="tracking-tight text-lg md:text-xl font-black">{title}</h2>
              {subtitle && (
                <p className="text-blue-200 text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 md:right-6 md:top-6 text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn("overflow-y-auto", compact ? "p-4 md:p-5" : "max-h-[70vh] px-5 md:px-8 py-5 md:py-6")}>{children}</div>
      </div>
    </div>
  );
}

/* Form fields -------------------------------------------------------------- */

const LABEL = "block text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1.5 md:mb-2";
const CONTROL =
  "w-full rounded-2xl bg-slate-50 border-none h-12 md:h-14 text-sm font-semibold px-4 md:px-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-100 placeholder:text-slate-400 placeholder:font-normal";

export function TextField({
  label,
  icon: Icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: LucideIcon }) {
  return (
    <div className={className}>
      <label className={LABEL} htmlFor={props.id ?? props.name}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        )}
        <input id={props.id ?? props.name} {...props} className={cn(CONTROL, Icon && "pl-11 md:pl-12")} />
      </div>
    </div>
  );
}

export function SelectField({
  label,
  options,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: readonly string[] | { value: string; label: string }[] }) {
  return (
    <div className={className}>
      <label className={LABEL} htmlFor={props.id ?? props.name}>
        {label}
      </label>
      <select id={props.id ?? props.name} {...props} className={cn(CONTROL, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_1rem_center]")}>
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </div>
  );
}

export function TextAreaField({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div className={className}>
      <label className={LABEL} htmlFor={props.id ?? props.name}>
        {label}
      </label>
      <textarea
        id={props.id ?? props.name}
        {...props}
        className={cn(CONTROL, "h-auto min-h-24 py-3 resize-y")}
      />
    </div>
  );
}
