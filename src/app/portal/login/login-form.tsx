"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Church,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Eye,
  EyeOff,
  UserCheck,
  Sparkles,
  ArrowLeft,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  lookupMemberId,
  activateMemberAccount,
  loginMember,
  requestPasswordReset,
  completePasswordReset,
  type LoginState,
} from "./actions";

export function MemberLoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [state, setState] = useState<LoginState>({ step: "initial" });
  const [memberCode, setMemberCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 1: Lookup Member ID
  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!memberCode.trim()) {
      toast.error("Please enter your Member ID.");
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
      {/* Step 1: Initial Member ID Lookup */}
      {state.step === "initial" && (
        <form onSubmit={handleLookup} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="memberId" className="block text-xs font-black uppercase tracking-wider text-slate-700">
              Enter Your Member ID
            </label>
            <div className="relative">
              <input
                id="memberId"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                value={memberCode}
                onChange={(e) => setMemberCode(e.target.value.toUpperCase())}
                placeholder="e.g. HSC-8K2P or WAM-D5PH"
                required
                className="w-full h-13 pl-4 pr-12 rounded-2xl border-2 border-slate-200 bg-white font-mono text-lg font-black tracking-widest text-slate-900 placeholder:text-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Smartphone className="h-5 w-5" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold text-slate-500 pt-0.5">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Holy Spirit: <strong className="font-mono text-blue-700">HSC-XXXX</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Central: <strong className="font-mono text-indigo-700">WAM-XXXX</strong>
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || !memberCode.trim()}
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white font-black text-sm tracking-wide shadow-lg shadow-blue-700/25 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
          >
            {pending ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Checking ID...</span>
              </>
            ) : (
              <>
                <span>Continue to Portal</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Step 2A: First Time Account Activation */}
      {state.step === "activate" && (
        <form onSubmit={handleActivate} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Welcome, {state.name}!
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                    {state.churchName}
                  </span>
                </div>
                <p className="text-xs font-medium text-amber-800 mt-1">
                  Set up your password to activate your portal. A 6-digit code was sent to {state.phoneMasked}.
                </p>
              </div>
            </div>
            {state.devOtp && (
              <p className="mt-2 text-[11px] font-mono font-bold text-amber-700 bg-amber-200/50 rounded-lg px-2 py-1">
                Demo/Dev OTP: {state.devOtp}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                6-Digit SMS Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white font-mono text-center text-xl font-black tracking-widest text-slate-900 placeholder:text-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Create a Password (min. 6 characters)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full h-11 pl-4 pr-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || otpCode.length < 6 || password.length < 6}
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-sm tracking-wide shadow-lg shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
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
            <ArrowLeft className="h-3.5 w-3.5" /> Back to change Member ID
          </button>
        </form>
      )}

      {/* Step 2B: Returning Member Login */}
      {state.step === "password" && (
        <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-950">
                  Welcome Back, {state.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs font-mono font-bold text-blue-700">
                    ID: {state.code}
                  </p>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    {state.churchName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setState({ step: "initial" })}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Switch ID
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={handleTriggerReset}
                disabled={pending}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="w-full h-12 pl-4 pr-11 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || !password}
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white font-black text-sm tracking-wide shadow-lg shadow-blue-700/25 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
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
            <ArrowLeft className="h-3.5 w-3.5" /> Back to enter a different Member ID
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
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                6-Digit Reset Code
              </label>
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white font-mono text-center text-xl font-black tracking-widest text-slate-900 placeholder:text-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                New Password (min. 6 characters)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || otpCode.length < 6 || password.length < 6}
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white font-black text-sm tracking-wide shadow-lg shadow-blue-700/25 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
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
