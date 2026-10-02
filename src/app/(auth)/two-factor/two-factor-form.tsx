"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, SubmitButton } from "@/components/auth-card";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { checkLoginStatus } from "../login/actions";

export function TwoFactorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const method = searchParams.get("method");
  const initialType = method === "email" ? "otp" : "totp";
  
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [type, setType] = useState<"totp" | "otp">(initialType);

  useEffect(() => {
    if (initialType === "otp") {
      handleSendOtp();
    }
  }, [initialType]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code"));
    setPending(true);
    setError(null);
    
    // First try the selected type, if error we might show it.
    // Better auth handles the verification
    let result;
    if (type === "totp") {
      result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
    } else {
      result = await authClient.twoFactor.verifyOtp({ code, trustDevice: false });
    }

    setPending(false);
    
    if (result.error) {
      setError(result.error.message ?? "Invalid verification code");
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
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  async function handleSendOtp() {
    setPending(true);
    const result = await authClient.twoFactor.sendOtp();
    setPending(false);
    if (result.error) {
      toast.error(result.error.message || "Failed to send code");
    } else {
      toast.success("A login code has been sent to your email.");
      setType("otp");
    }
  }

  return (
    <div className="space-y-6">

      <form onSubmit={onSubmit} className="space-y-5">
        <Field 
          label="Verification Code" 
          name="code" 
          type="text" 
          required 
          placeholder="123456" 
          icon={<KeyRound />} 
          autoComplete="one-time-code" 
        />
        
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        
        <SubmitButton pending={pending}>Verify & Sign In</SubmitButton>
      </form>

      {type === "otp" && (
        <div className="text-center">
          <button 
            onClick={handleSendOtp}
            type="button" 
            disabled={pending}
            className="text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            Didn't receive a code? Send again
          </button>
        </div>
      )}
    </div>
  );
}
