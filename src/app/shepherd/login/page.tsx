import Link from "next/link";
import { Compass, ShieldCheck, Heart, Users } from "lucide-react";
import { ShepherdLoginForm } from "./login-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shepherd Portal Login",
  description: "Access discipleship tracking, service attendance registers, and spiritual care overview.",
};

export default async function ShepherdLoginPage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[ShepherdLoginPage] Unable to fetch church branding:", err);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/50 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-2 py-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={churchData?.logoUrl || "https://res.cloudinary.com/dm5bp1efp/image/upload/v1792173363/churchy/branding/noka8l1kbu6jz0zuzrva.png"}
              alt={churchData?.name || "World Ark Missions"}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 block truncate max-w-[140px] min-[400px]:max-w-[220px] sm:max-w-none">
              {churchData?.name || "World Ark Missions"}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block truncate">
              Shepherd &amp; Discipleship Portal
            </span>
          </div>
        </div>

        <Link
          href="/login"
          className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white/80 hover:bg-white border border-slate-200/80 px-2.5 sm:px-3.5 py-1.5 rounded-xl shadow-2xs transition-all shrink-0 whitespace-nowrap"
        >
          <span className="hidden sm:inline">Admin / Staff Sign In →</span>
          <span className="sm:hidden">Staff Login →</span>
        </Link>
      </div>

      {/* Main Center Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1e3a8a]/10 text-[#1e3a8a] mb-1">
              <Compass className="h-6 w-6 text-[#1e3a8a]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Shepherd Sign In
            </h1>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Manage your disciples, track service attendance, and oversee their prayer and spiritual walk.
            </p>
          </div>

          <ShepherdLoginForm
            defaultLogoUrl={churchData?.logoUrl}
            defaultChurchName={churchData?.name}
          />

          <div className="pt-2 border-t border-slate-100 flex items-center justify-around text-center">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span>Flock Register</span>
            </div>
            <span className="text-slate-200">•</span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Heart className="h-3.5 w-3.5 text-red-500" />
              <span>Spiritual Care</span>
            </div>
            <span className="text-slate-200">•</span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              <span>Discipleship</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl mx-auto py-4 text-center">
        <p className="text-[11px] font-bold text-slate-400">
          Powered by {churchData?.name || "World Ark Missions"} • Pastoral Care &amp; Discipleship System
        </p>
      </div>
    </div>
  );
}
