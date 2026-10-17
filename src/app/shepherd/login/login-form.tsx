"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { loginShepherd } from "./actions";

export function ShepherdLoginForm({
  defaultLogoUrl,
  defaultChurchName,
}: {
  defaultLogoUrl?: string | null;
  defaultChurchName?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your Phone number, Email, or Shepherd Code.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    startTransition(async () => {
      const res = await loginShepherd(identifier, password);
      if (!res.ok) {
        toast.error(res.error || "Login failed.");
        return;
      }
      toast.success("Welcome back! Signing in to Shepherd Portal...");
      router.push("/shepherd-portal");
      router.refresh();
    });
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Phone, Email, or Shepherd ID
          </label>
          <div className="relative">
            <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 0244123456 or SHP-8K2X"
              required
              disabled={pending}
              className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-white/90 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all shadow-xs"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            Enter the phone number or Shepherd code provided by church leadership.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={pending}
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-white/90 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all shadow-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full h-11.5 mt-2 rounded-xl bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white text-xs font-black uppercase tracking-wider shadow-md hover:from-blue-900 hover:to-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {pending ? (
            <span>Signing in...</span>
          ) : (
            <>
              <span>Access Shepherd Portal</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <div className="pt-3 text-center">
          <p className="text-xs text-slate-500">
            Forgot your credentials or need access?{" "}
            <span className="font-bold text-[#1e3a8a]">
              Contact your church administrator.
            </span>
          </p>
        </div>
      </form>
    </div>
  );
}
