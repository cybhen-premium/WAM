"use client";

import { useState, useEffect } from "react";
import { Church, Eye, EyeOff } from "lucide-react";

export const DEFAULT_CHURCH_LOGO =
  "https://res.cloudinary.com/dm5bp1efp/image/upload/v1792173363/churchy/branding/noka8l1kbu6jz0zuzrva.png";

export function AuthCard({
  title,
  subtitle,
  logoUrl,
  children,
}: {
  title: string;
  subtitle: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const [currentSrc, setCurrentSrc] = useState<string>(logoUrl || DEFAULT_CHURCH_LOGO);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(logoUrl || DEFAULT_CHURCH_LOGO);
    setHasError(false);
  }, [logoUrl]);

  function handleError() {
    if (currentSrc !== "/logo.png" && currentSrc !== "/wam.png") {
      setCurrentSrc("/logo.png");
    } else if (currentSrc === "/logo.png") {
      setCurrentSrc("/wam.png");
    } else {
      setHasError(true);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-200">
        <div className="bg-[#1E3A8A] px-8 py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md overflow-hidden p-1.5">
            {!hasError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentSrc}
                alt="Church Logo"
                className="h-full w-full object-contain"
                onError={handleError}
              />
            ) : (
              <Church className="h-8 w-8 text-[#1E3A8A]" />
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

export function SubmitButton({
  children,
  pending = false,
  className,
}: {
  children: React.ReactNode;
  pending?: boolean;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex h-12 w-full items-center justify-center rounded-xl bg-[#1E3A8A] font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-900 active:scale-[0.99] disabled:opacity-50 ${className ?? ""}`}
    >
      {pending ? "Please wait..." : children}
    </button>
  );
}
