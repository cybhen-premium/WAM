"use client";

import { useState } from "react";
import { Church, Eye, EyeOff } from "lucide-react";

export function AuthCard({ title, subtitle, logoUrl, children }: { title: string; subtitle: string; logoUrl?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-200">
        <div className="bg-[#1E3A8A] px-8 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Church Logo" className="h-full w-full object-contain bg-white" />
            ) : (
              <Church className="h-7 w-7 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-sm text-blue-100/80">{subtitle}</p>
        </div>
        <div className="px-6 py-8">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  icon,
  className,
  type,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: React.ReactNode }) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);

  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-2 block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400">{label}</span>
      <span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        {icon && <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
        <input
          {...input}
          type={isPassword ? (show ? "text" : "password") : type}
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors [&_svg]:h-4 [&_svg]:w-4"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        )}
      </span>
    </label>
  );
}

export function SubmitButton({ children, pending }: { children: React.ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold shadow-button transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
