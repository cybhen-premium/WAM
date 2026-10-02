"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Lock, Mail, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AuthCard, Field, SubmitButton } from "@/components/auth-card";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "Could not create account");
    // Full navigation so the new session cookie is used (see login page).
    const ref = new URLSearchParams(window.location.search).get("ref");
    window.location.assign("/login?suspended=true");
  }

  return (
    <AuthCard title="Create your account" subtitle="Start managing your church in minutes">
      <Suspense>
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Full Name" name="name" required placeholder="e.g., John Mensah" icon={<User />} autoComplete="name" />
          <Field label="Email" name="email" type="email" required placeholder="you@church.org" icon={<Mail />} autoComplete="email" />
          <Field label="Password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" icon={<Lock />} autoComplete="new-password" />
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
          <SubmitButton pending={pending}>Create Account</SubmitButton>
          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </Suspense>
    </AuthCard>
  );
}
