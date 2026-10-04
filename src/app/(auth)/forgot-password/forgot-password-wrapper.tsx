"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, CheckCircle } from "lucide-react";
import { AuthCard, Field, SubmitButton } from "@/components/auth-card";
import { authClient } from "@/lib/auth-client";
import { sendPasswordResetConfirmation } from "./actions";
import { checkStatusByEmail } from "../login/actions";

export function ForgotPasswordWrapper({ logoUrl }: { logoUrl?: string | null }) {
  const [step, setStep] = useState<"request" | "verify-otp" | "otp-success" | "new-password" | "done">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRequestSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const inputEmail = String(form.get("email") ?? "").trim().toLowerCase();
    setPending(true);
    setError(null);

    // Block non-existent, deleted, suspended, and pending accounts
    const status = await checkStatusByEmail(inputEmail);
    if (!status || status === "deleted") {
      setPending(false);
      setError("No account found with that email address.");
      return;
    }
    if (status === "suspended") {
      setPending(false);
      setError("Your account has been suspended. Please contact your administrator.");
      return;
    }
    if (status === "pending") {
      setPending(false);
      setError("Your account is pending approval. Please contact your administrator.");
      return;
    }
    if (status !== "active") {
      setPending(false);
      setError("No account found with that email address.");
      return;
    }

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: inputEmail,
      type: "forget-password",
    });
    setPending(false);
    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      return;
    }
    setEmail(inputEmail);
    setStep("verify-otp");
  }

  async function onVerifyOtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const inputOtp = String(form.get("otp") ?? "").trim();
    
    setPending(true);
    setError(null);

    const status = await checkStatusByEmail(email);
    if (!status || status !== "active") {
      setPending(false);
      setError("No active account found with that email address.");
      return;
    }
    
    // Better Auth exposes endpoints on the client automatically.
    // If the check method doesn't exist on the client object for some reason, we can fallback to fetch.
    const res = await fetch("/api/auth/email-otp/check-verification-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type: "forget-password", otp: inputOtp }),
    });
    const data = await res.json();
    setPending(false);

    if (data.error || !data.success) {
      setError(data.error?.message || "Invalid code or expired. Please try again.");
      return;
    }

    setOtp(inputOtp);
    setStep("otp-success");
  }

  async function onNewPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("newPassword"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setPending(true);
    setError(null);

    const status = await checkStatusByEmail(email);
    if (!status || status !== "active") {
      setPending(false);
      setError("No active account found with that email address.");
      return;
    }

    const { error } = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password: newPassword,
    });
    setPending(false);

    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      return;
    }
    
    // Send confirmation email
    await sendPasswordResetConfirmation(email);

    setStep("done");
  }

  if (step === "otp-success") {
    return (
      <AuthCard title="Code Verified!" subtitle="Your identity has been confirmed" logoUrl={logoUrl}>
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-sm text-slate-600">
            Your reset code was successfully verified.
          </p>
          <button
            onClick={() => setStep("new-password")}
            className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-extrabold text-white hover:opacity-95"
          >
            Continue to New Password
          </button>
        </div>
      </AuthCard>
    );
  }

  if (step === "done") {
    return (
      <AuthCard title="Password updated!" subtitle="You can now sign in" logoUrl={logoUrl}>
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-sm text-slate-600">
            Your password has been successfully updated.
          </p>
          <Link
            href="/login"
            className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-extrabold text-white hover:opacity-95"
          >
            Sign In
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (step === "new-password") {
    return (
      <AuthCard
        title="Set new password"
        subtitle="Choose a strong password for your account"
        logoUrl={logoUrl}
      >
        <form onSubmit={onNewPasswordSubmit} className="space-y-5">
          <Field
            label="New Password"
            name="newPassword"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            icon={<Lock />}
            autoComplete="new-password"
          />
          <Field
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            placeholder="Repeat your new password"
            icon={<Lock />}
            autoComplete="new-password"
          />
          {error && (
            <p className="text-sm font-semibold text-destructive">{error}</p>
          )}
          <SubmitButton pending={pending}>Update Password</SubmitButton>
        </form>
      </AuthCard>
    );
  }

  if (step === "verify-otp") {
    return (
      <AuthCard
        title="Enter Reset Code"
        subtitle={`We sent a code to ${email}`}
        logoUrl={logoUrl}
      >
        <form onSubmit={onVerifyOtpSubmit} className="space-y-5">
          <Field
            label="Reset Code"
            name="otp"
            type="text"
            required
            placeholder="e.g. 123456"
            autoComplete="one-time-code"
          />
          {error && (
            <p className="text-sm font-semibold text-destructive">{error}</p>
          )}
          <SubmitButton pending={pending}>Verify Code</SubmitButton>
          <button
            type="button"
            className="w-full text-center text-sm font-bold text-slate-500 hover:text-slate-800"
            onClick={() => setStep("request")}
          >
            Use a different email
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset code"
      logoUrl={logoUrl}
    >
      <form onSubmit={onRequestSubmit} className="space-y-5">
        <Field
          label="Email"
          name="email"
          type="email"
          required
          placeholder="you@church.org"
          icon={<Mail />}
          autoComplete="email"
        />
        {error && (
          <p className="text-sm font-semibold text-destructive">{error}</p>
        )}
        <SubmitButton pending={pending}>Send Reset Code</SubmitButton>
        <p className="text-center text-sm text-slate-500">
          Remember your password?{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
