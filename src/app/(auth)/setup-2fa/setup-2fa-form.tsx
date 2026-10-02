"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, SubmitButton } from "@/components/auth-card";
import { toast } from "sonner";
import { Lock, Mail, ScanFace } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { checkLoginStatus } from "../login/actions";

export function SetupTwoFactorForm({ mandatedMethod }: { mandatedMethod: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const handleStartSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required to setup 2FA");
      return;
    }

    setPending(true);
    setError(null);
    
    const { data, error: apiError } = await authClient.twoFactor.enable({
      password,
      method: mandatedMethod === "totp" ? "totp" : "otp",
    });

    if (apiError) {
      setPending(false);
      setError(apiError.message ?? "Failed to enable 2FA");
      return;
    }
    
    if (mandatedMethod === "email") {
      const sendResult = await authClient.twoFactor.sendOtp();
      setPending(false);
      if (sendResult.error) {
        setError(sendResult.error.message || "Failed to send code");
        return;
      }
      toast.success("A verification code has been sent to your email.");
      setShowEmailVerification(true);
      return;
    }

    setPending(false);
    // If method is totp, show the QR code
    if ((data as any)?.totpURI) {
      setTotpURI((data as any).totpURI);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setError("Please enter the verification code");
      return;
    }

    setPending(true);
    setError(null);

    const { error: apiError } = await authClient.twoFactor.verifyOtp({ code, trustDevice: false });
    
    setPending(false);

    if (apiError) {
      setError(apiError.message ?? "Invalid code");
      return;
    }
    
    toast.success("Email 2FA setup complete!");
    await proceed();
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setPending(true);
    setError(null);

    const { error: apiError } = await authClient.twoFactor.verifyTotp({ code });
    
    setPending(false);

    if (apiError) {
      setError(apiError.message ?? "Invalid code");
      return;
    }
    
    toast.success("Authenticator App setup complete!");
    await proceed();
  };

  const proceed = async () => {
    const { status } = await checkLoginStatus();
    if (status === "suspended" || status === "pending") {
      router.replace(`/login?status=${status}`);
      return;
    }
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  };

  if (showEmailVerification) {
    return (
      <form onSubmit={handleVerifyEmail} className="space-y-5">
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-full mb-3">
            <Mail className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700 text-center">
            A verification code has been sent to your email address.
          </p>
        </div>
        
        <Field 
          label="Verification Code" 
          name="code" 
          type="text" 
          placeholder="123456" 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          required 
        />
        
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        <SubmitButton pending={pending}>Verify and Complete Setup</SubmitButton>
      </form>
    );
  }

  if (totpURI) {
    return (
      <form onSubmit={handleVerifyTotp} className="space-y-5">
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
          <p className="text-sm font-semibold text-slate-700 mb-4 text-center">
            Scan this QR code with your Authenticator App (like Google Authenticator or Authy).
          </p>
          <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
            <QRCodeCanvas value={totpURI} size={180} />
          </div>
        </div>
        
        <Field 
          label="Verification Code" 
          name="code" 
          type="text" 
          placeholder="123456" 
          icon={<ScanFace />} 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          maxLength={6} 
          required 
        />
        
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        <SubmitButton pending={pending}>Verify and Complete Setup</SubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={handleStartSetup} className="space-y-5">
      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full">
          {mandatedMethod === "totp" ? <ScanFace className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
        </div>
        <p className="text-sm font-semibold text-amber-900 leading-tight">
          Please confirm your password to configure your required Two-Factor Authentication method.
        </p>
      </div>

      <Field 
        label="Current Password" 
        name="password" 
        type="password" 
        placeholder="••••••••" 
        icon={<Lock />} 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        required 
      />
      
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      <SubmitButton pending={pending}>Configure {mandatedMethod === 'totp' ? 'Authenticator App' : 'Email 2FA'}</SubmitButton>
    </form>
  );
}
