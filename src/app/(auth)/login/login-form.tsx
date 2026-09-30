"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Field, SubmitButton } from "@/components/auth-card";
import Link from "next/link";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  // "/" routes to the dashboard, or to the first module this user was given access to.
  const next = useSearchParams().get("next") ?? "/";
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
    
    toast.success("Signed in successfully!");
    
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Email" name="email" type="email" required placeholder="you@church.org" icon={<Mail />} autoComplete="email" />
      <div>
        <Field label="Password" name="password" type="password" required placeholder="••••••••" icon={<Lock />} autoComplete="current-password" />
        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-xs font-bold text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      <SubmitButton pending={pending}>Sign In</SubmitButton>
    </form>
  );
}
