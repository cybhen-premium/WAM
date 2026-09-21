"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AuthCard, Field, SubmitButton } from "@/components/auth-card";

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your sanctuary">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}

function LoginForm() {
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "Could not sign in");
    // Full navigation: the client router may have cached the pre-login redirect to /login.
    window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Email" name="email" type="email" required placeholder="you@church.org" icon={<Mail />} autoComplete="email" />
      <Field label="Password" name="password" type="password" required placeholder="••••••••" icon={<Lock />} autoComplete="current-password" />
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      <SubmitButton pending={pending}>Sign In</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        New to EcclesiaSync?{" "}
        <Link href="/signup" className="font-bold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
