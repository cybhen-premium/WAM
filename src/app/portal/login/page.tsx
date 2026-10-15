import { Suspense } from "react";
import Link from "next/link";
import { Church, ShieldCheck, Heart, Clock } from "lucide-react";
import { MemberLoginForm } from "./login-form";
import { db } from "@/db";

export const metadata = {
  title: "Member Portal Login",
  description: "Access your church member dashboard, tithes, welfare dues, and pastoral support.",
};

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isTimedOut = params?.reason === "timeout" || params?.expired === "true";
  const churchData = await db.query.church.findFirst();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/50 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-2 py-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden p-1">
            {churchData?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={churchData.logoUrl}
                alt={churchData.name || "Church Logo"}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white">
                <Church className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 block truncate max-w-[140px] min-[400px]:max-w-[220px] sm:max-w-none">
              World Ark Missions
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block truncate">
              Member Portal
            </span>
          </div>
        </div>

        <Link
          href="/login"
          className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white/80 hover:bg-white border border-slate-200/80 px-2.5 sm:px-3.5 py-1.5 rounded-xl shadow-2xs transition-all shrink-0 whitespace-nowrap"
        >
          <span className="hidden sm:inline">Staff &amp; Admin Sign In →</span>
          <span className="sm:hidden">Staff Login →</span>
        </Link>
      </div>

      {/* Main Center Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
        <div className="rounded-3xl bg-white p-5 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
          <div className="text-center mb-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white mb-3 border border-slate-100 shadow-md shadow-slate-200/60 overflow-hidden p-1.5">
              {churchData?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={churchData.logoUrl}
                  alt={churchData.name || "Church Logo"}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-700 rounded-xl">
                  <Church className="h-8 w-8" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Member Portal
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Sign in with your Member ID or registered phone number to view your contributions, update your photo, and connect with pastoral care.
            </p>
          </div>

          {/* Session Inactivity Timeout Alert */}
          {isTimedOut && (
            <div className="mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 flex items-start gap-3 text-amber-900 animate-in fade-in duration-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700">
                <Clock className="h-4 w-4 stroke-[2.2]" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-amber-950">
                  Session Expired
                </p>
                <p className="text-xs text-amber-800 font-medium mt-0.5 leading-relaxed">
                  Your member portal session timed out due to inactivity. Please sign in again with your Member ID or phone number.
                </p>
              </div>
            </div>
          )}

          <Suspense fallback={<div className="h-36 rounded-2xl bg-slate-50 animate-pulse" />}>
            <MemberLoginForm
              defaultLogoUrl={churchData?.logoUrl}
              defaultChurchName={churchData?.name}
            />
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
        © {new Date().getFullYear()} World Ark Missions · Member Self-Service
      </div>
    </div>
  );
}
