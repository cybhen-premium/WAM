import { Suspense } from "react";
import Link from "next/link";
import { Church, ShieldCheck, Heart, User } from "lucide-react";
import { MemberLoginForm } from "./login-form";

export const metadata = {
  title: "Member Portal Login",
  description: "Access your church member dashboard, tithes, welfare dues, and pastoral support.",
};

export default function MemberLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/50 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white shadow-md">
            <Church className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
              WAM Sanctuary
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Member Portal
            </span>
          </div>
        </div>

        <Link
          href="/login"
          className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white/80 hover:bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs transition-all"
        >
          Staff &amp; Admin Sign In →
        </Link>
      </div>

      {/* Main Center Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
          <div className="text-center mb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 mb-3 border border-blue-100 shadow-inner">
              <User className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Member Portal
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Sign in with your unique Member ID to view your contributions, update your photo, and connect with pastoral care.
            </p>
          </div>

          <Suspense fallback={<div className="h-36 rounded-2xl bg-slate-50 animate-pulse" />}>
            <MemberLoginForm />
          </Suspense>
        </div>

        {/* Security Trust Badge */}
        <div className="mt-6 flex items-center justify-center gap-4 text-slate-400 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Secure Encryption
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-rose-500" /> Dedicated Member Care
          </span>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="w-full max-w-md mx-auto text-center py-2 text-[11px] text-slate-400 font-medium">
        © {new Date().getFullYear()} Church Management Platform · Member Self-Service
      </div>
    </div>
  );
}
