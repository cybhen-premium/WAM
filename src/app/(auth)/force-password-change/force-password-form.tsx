"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Field, SubmitButton } from "@/components/auth-card";
import { toast } from "sonner";
import { checkLoginStatus, forcePasswordChange } from "../login/actions";

export function ForcePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setPending(true);
    setError(null);
    
    try {
      await forcePasswordChange(password);
    } catch (err: any) {
      setPending(false);
      setError(err.message ?? "Could not update password");
      return;
    }
    setPending(false);

    const { status, missingTwoFactorSetup } = await checkLoginStatus();
    
    if (status === "suspended" || status === "pending") {
      router.replace(`/login?status=${status}`);
      return;
    }
    
    if (missingTwoFactorSetup) {
      router.push(`/setup-2fa?next=${encodeURIComponent(next)}`);
      return;
    }
    
    toast.success("Password updated successfully!");
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field 
        label="New Password" 
        name="password" 
        type="password" 
        required 
        placeholder="••••••••" 
        icon={<Lock />} 
        autoComplete="new-password" 
      />
      <Field 
        label="Confirm Password" 
        name="confirmPassword" 
        type="password" 
        required 
        placeholder="••••••••" 
        icon={<Lock />} 
        autoComplete="new-password" 
      />
      
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      
      <SubmitButton pending={pending}>Save & Sign In</SubmitButton>
    </form>
  );
}
