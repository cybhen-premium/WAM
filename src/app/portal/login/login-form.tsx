"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Church,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  Smartphone,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  lookupMemberId,
  selectMemberForPassword,
  activateMemberAccount,
  loginMember,
  requestPasswordReset,
  completePasswordReset,
  type LoginState,
} from "./actions";

function formatChurchName(name?: string | null) {
  if (!name) return "World Ark Missions";
  return name.replace(/\s*[-–—]\s*Holy Spirit.*$/i, "").trim() || "World Ark Missions";
}

export function MemberLoginForm({
  defaultLogoUrl,
  defaultChurchName,
}: {
  defaultLogoUrl?: string | null;
  defaultChurchName?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [state, setState] = useState<LoginState>({ step: "initial" });
  const [memberCode, setMemberCode] = useState(() => (searchParams.get("id") ?? "").toUpperCase());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 1: Lookup Member ID or Phone Number
  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!memberCode.trim()) {
      toast.error("Please enter your Member ID or registered phone number.");
      return;
    }

    startTransition(async () => {
      const res = await lookupMemberId(memberCode);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setState(res);
      if (res.step === "activate") {
        toast.success(`Verification code sent to ${res.phoneMasked}`);
      }
    });
  }

  // Step 2A: Activate Account
  function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (state.step !== "activate") return;

    if (!otpCode.trim()) {
      toast.error("Please enter the 6-digit code received via SMS.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const res = await activateMemberAccount(state.memberId, otpCode, password);
      if (!res.ok) {
        toast.error(res.error || "Failed to activate account.");
        return;
      }
      toast.success("Account activated successfully! Logging in...");
      router.push("/portal");
      router.refresh();
    });
  }

  // Step 2B: Standard Password Login
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (state.step !== "password") return;

    if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    startTransition(async () => {
      const res = await loginMember(state.memberId, password);
      if (!res.ok) {
        toast.error(res.error || "Incorrect password.");
        return;
      }
      toast.success(`Welcome back, ${state.name}!`);
      router.push("/portal");
      router.refresh();
    });
  }

  // Step 2C: Trigger Reset
  function handleTriggerReset() {
    if (state.step !== "password") return;

    startTransition(async () => {
      const res = await requestPasswordReset(state.memberId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setState(res);
      toast.success("Password reset code sent to your phone.");
    });
  }

  // Step 2D: Complete Reset
  function handleCompleteReset(e: React.FormEvent) {
    e.preventDefault();
    if (state.step !== "reset") return;

    if (!otpCode.trim()) {
      toast.error("Please enter the 6-digit reset code.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const res = await completePasswordReset(state.memberId, otpCode, password);
      if (!res.ok) {
        toast.error(res.error || "Failed to reset password.");
        return;
      }
      toast.success("Password reset successful! Logging in...");
      router.push("/portal");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Step 1: Initial Member ID or Phone Lookup */}
      {state.step === "initial" && (
        <form onSubmit={handleLookup} className="space-y-5">
          <div className="space-y-1.5">
            <span className="block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400">
              Member ID or Phone Number
            </span>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
              <Smartphone className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                id="memberId"
                type="text"
                autoComplete="username"
                value={memberCode}
                onChange={(e) => setMemberCode(e.target.value.toUpperCase())}
                placeholder="e.g. WAM-8K2P or 0244123456"
                required
                className="w-full bg-transparent font-mono text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 outline-none uppercase"
              />
            </div>
            <p className="text-[11px] text-slate-400 font-medium px-1">
              Sign in with your Member ID (e.g. <strong className="font-mono text-[#1E3A8A]">WAM-XXXX</strong>) or registered phone number.
            </p>
          </div>

          <button
            type="submit"
            disabled={pending || !memberCode.trim()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-900 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {pending ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Checking Account...</span>
              </>
            ) : (
              <>
                <span>Continue to Portal</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="pt-3 text-center space-y-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Need assistance with your Member ID?{" "}
              <span className="font-semibold text-slate-700">Contact church office</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs">
              <Link
                href="/shepherd/login"
                className="font-bold text-[#1E3A8A] hover:underline"
              >
                Shepherd Portal Sign In →
              </Link>
              <span className="text-slate-300">•</span>
              <Link
                href="/login"
                className="font-bold text-[#1E3A8A] hover:underline"
              >
                Staff / Admin Login →
              </Link>
            </div>
          </div>
        </form>
      )}

      {/* Step 1B: Multi-Account Selection (When Phone matches multiple registered branches) */}
      {state.step === "select_account" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="text-center">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Select Your Church Branch
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Multiple registered accounts were found for this phone number. Choose which branch to access:
            </p>
          </div>

          <div className="space-y-2.5">
            {state.accounts.map((acc) => (
              <button
                key={acc.memberId}
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    const res = await selectMemberForPassword(acc.memberId);
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    setState(res);
                  });
                }}
                disabled={pending}
                className="w-full text-left p-3.5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/50 shadow-2xs hover:shadow-md transition-all flex items-center gap-3 group cursor-pointer"
              >
                <div className="h-12 w-12 shrink-0 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden">
                  {acc.churchLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={acc.churchLogo} alt={acc.churchName} className="h-full w-full object-contain" />
                  ) : (
                    <Church className="h-6 w-6 text-blue-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-blue-700 truncate">
                      {acc.name}
                    </span>
                    <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {acc.code}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                    {formatChurchName(acc.churchName)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setState({ step: "initial" })}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to enter different details
          </button>
        </div>
      )}

      {/* Step 2A: First Time Account Activation */}
      {state.step === "activate" && (
        <form onSubmit={handleActivate} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-center gap-3">
              {state.churchLogo || defaultLogoUrl ? (
                <div className="h-11 w-11 shrink-0 rounded-xl bg-white border border-amber-300/60 p-1 shadow-2xs flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.churchLogo || defaultLogoUrl!}
                    alt={formatChurchName(state.churchName || defaultChurchName)}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-amber-900 truncate">
                  Welcome, {state.name}!
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 text-[10px] font-black uppercase tracking-wider truncate max-w-[190px]">
                    {formatChurchName(state.churchName)}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-800">
                    ({state.code})
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs font-medium text-amber-800 mt-2.5">
              Set up your password to activate your portal. A 6-digit code was sent to {state.phoneMasked}.
            </p>
            {state.devOtp && (
              <p className="mt-2 text-[11px] font-mono font-bold text-amber-700 bg-amber-200/50 rounded-lg px-2 py-1">
                Demo/Dev OTP: {state.devOtp}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <span className="block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400 mb-1.5">
                6-Digit SMS Verification Code
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  className="w-full bg-transparent font-mono text-center text-xl font-black tracking-widest text-slate-900 placeholder:text-slate-300 outline-none"
                />
              </div>
            </div>

            <div>
              <span className="block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400 mb-1.5">
                Create a Password (min. 6 characters)
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
                <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <span className="block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400 mb-1.5">
                Confirm Password
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
                <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || otpCode.length < 6 || password.length < 6}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-900 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {pending ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Activating Account...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Activate Account &amp; Log In</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setState({ step: "initial" })}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-1 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to change Member ID or Phone
          </button>
        </form>
      )}

      {/* Step 2B: Returning Member Login */}
      {state.step === "password" && (
        <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
            <div className="flex items-center gap-3">
              {state.churchLogo || defaultLogoUrl ? (
                <div className="h-11 w-11 shrink-0 rounded-xl bg-white border border-blue-200/60 p-1 shadow-2xs flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.churchLogo || defaultLogoUrl!}
                    alt={formatChurchName(state.churchName || defaultChurchName)}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-blue-950 truncate">
                  Welcome Back, {state.name}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-mono font-bold text-blue-700">
                    ID: {state.code}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded-md truncate max-w-[170px]">
                    {formatChurchName(state.churchName)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setState({ step: "initial" })}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline shrink-0"
              >
                Switch
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-tight text-slate-400">
                Password
              </span>
              <button
                type="button"
                onClick={handleTriggerReset}
                disabled={pending}
                className="text-xs font-bold text-[#1E3A8A] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
              <Lock className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="shrink-0 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || !password}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-900 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {pending ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setState({ step: "initial" })}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-1 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to enter different details
          </button>
        </form>
      )}

      {/* Step 2C: Password Reset Flow */}
      {state.step === "reset" && (
        <form onSubmit={handleCompleteReset} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-blue-950">
              Reset Your Password
            </p>
            <p className="text-xs font-medium text-blue-800 mt-0.5">
              Enter the 6-digit verification code sent to {state.phoneMasked} and choose a new password.
            </p>
            {state.devOtp && (
              <p className="mt-2 text-[11px] font-mono font-bold text-blue-700 bg-blue-200/50 rounded-lg px-2 py-1">
                Demo/Dev OTP: {state.devOtp}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <span className="block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400 mb-1.5">
                6-Digit Reset Code
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  className="w-full bg-transparent font-mono text-center text-xl font-black tracking-widest text-slate-900 placeholder:text-slate-300 outline-none"
                />
              </div>
            </div>

            <div>
              <span className="block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400 mb-1.5">
                New Password (min. 6 characters)
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
                <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <span className="block px-1 text-[10px] font-extrabold uppercase tracking-tight text-slate-400 mb-1.5">
                Confirm New Password
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/20 transition-all">
                <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || otpCode.length < 6 || password.length < 6}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-900 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {pending ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Save New Password &amp; Log In</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setState({ step: "initial" })}
            className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-1 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Cancel and return to Login
          </button>
        </form>
      )}
    </div>
  );
}
