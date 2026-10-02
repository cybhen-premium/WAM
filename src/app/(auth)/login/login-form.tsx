"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, AlertTriangle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Field, SubmitButton } from "@/components/auth-card";
import Link from "next/link";
import { toast } from "sonner";
import { checkLoginStatus, getTwoFactorMethodByEmail, checkStatusByEmail } from "./actions";

export function LoginForm() {
  const router = useRouter();
  // "/" routes to the dashboard, or to the first module this user was given access to.
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const suspended = searchParams.get("suspended") === "true";
  
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      return setError("Invalid email or password");
    }
    
    if ((data as any)?.twoFactorRedirect) {
      const email = String(form.get("email"));

      // Block restricted accounts before they ever reach the 2FA page.
      const preStatus = await checkStatusByEmail(email);
      if (preStatus === "deleted" || preStatus === "suspended" || preStatus === "pending") {
        await authClient.signOut();
        if (preStatus === "deleted") {
          return setError("Invalid email or password");
        }
        router.replace(`/login?status=${preStatus}`);
        return;
      }

      const method = await getTwoFactorMethodByEmail(email);
      router.push(`/two-factor?next=${encodeURIComponent(next)}&method=${method}`);
      return;
    }

    const { status, missingTwoFactorSetup } = await checkLoginStatus();

    if (status === "suspended" || status === "pending" || status === "deleted") {
      router.replace(`/login?status=${status}`);
      return;
    }

    const { data: sessionData } = await authClient.getSession();
    if ((sessionData?.user as any)?.passwordChangeRequired) {
      router.push(`/force-password-change?next=${encodeURIComponent(next)}`);
      return;
    }
    
    if (missingTwoFactorSetup) {
      router.push(`/setup-2fa?next=${encodeURIComponent(next)}`);
      return;
    }
    
    toast.success("Signed in successfully!");
    window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }
  
  async function closeSuspendedModal() {
    await authClient.signOut();
    router.replace("/login");
  }

  const restrictedStatus = searchParams.get("status") || (searchParams.get("suspended") === "true" ? "suspended" : null);

  let modalTitle = "";
  let modalDesc = "";
  if (restrictedStatus === "suspended") {
    modalTitle = "Account Suspended";
    modalDesc = "Your account has been suspended by an administrator. Please contact them for assistance.";
  } else if (restrictedStatus === "pending") {
    modalTitle = "Account Pending";
    modalDesc = "Your account is currently pending approval. Please ask your administrator to approve your account before you can access the system.";
  } else if (restrictedStatus === "deleted") {
    modalTitle = "Account Removed";
    modalDesc = "Your access has been permanently revoked by an administrator.";
  }

  return (
    <>
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

      {restrictedStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${restrictedStatus === "pending" ? "bg-amber-100" : "bg-red-100"}`}>
                <AlertTriangle className={`h-6 w-6 ${restrictedStatus === "pending" ? "text-amber-600" : "text-red-600"}`} />
              </div>
            </div>
            <h3 className="text-center text-lg font-bold text-slate-900">
              {modalTitle}
            </h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              {modalDesc}
            </p>
            <button
              onClick={closeSuspendedModal}
              className="mt-6 w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 hover:bg-slate-200 transition-colors"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </>
  );
}
