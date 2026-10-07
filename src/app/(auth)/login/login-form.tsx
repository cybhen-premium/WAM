"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, AlertTriangle, Clock, Church, Check, ChevronRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Field, SubmitButton } from "@/components/auth-card";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  checkLoginStatus,
  getTwoFactorMethodByEmail,
  checkStatusByEmail,
  selectBranchForSession,
} from "./actions";

export function LoginForm() {
  const router = useRouter();
  // "/" routes to the dashboard, or to the first module this user was given access to.
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const suspended = searchParams.get("suspended") === "true";
  const isExpired = searchParams.get("reason") === "expired" || searchParams.get("expired") === "true";
  
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Multi-branch selection state
  const [availableBranches, setAvailableBranches] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [selectingBranch, setSelectingBranch] = useState(false);

  async function handleProceedWithBranch() {
    if (!selectedBranchId) return;
    setSelectingBranch(true);
    try {
      const res = await selectBranchForSession(selectedBranchId);
      if (!res.ok) {
        toast.error(res.error || "Failed to select branch");
        setSelectingBranch(false);
        return;
      }
      toast.success(`Entered ${res.branchName || "Sanctuary"}`);
      window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch {
      toast.error("An error occurred while switching branches.");
      setSelectingBranch(false);
    }
  }

  async function handleBackToLogin() {
    await authClient.signOut();
    setShowBranchPicker(false);
    setAvailableBranches([]);
    setSelectedBranchId("");
  }

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

    const { status, missingTwoFactorSetup, branches } = await checkLoginStatus();

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

    // Branch selection logic
    if (branches && branches.length > 1) {
      setAvailableBranches(branches);
      setSelectedBranchId(branches[0].id);
      setShowBranchPicker(true);
      return;
    }

    if (branches && branches.length === 1) {
      await selectBranchForSession(branches[0].id);
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
      {showBranchPicker ? (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="text-center space-y-1">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-xs mb-3">
              <Church className="h-6 w-6 stroke-[2.2]" />
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Select Church Branch
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              Choose which branch sanctuary to enter for this session
            </p>
          </div>

          <div className="space-y-2.5">
            {availableBranches.map((branch) => {
              const isSelected = selectedBranchId === branch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer",
                    isSelected
                      ? "border-amber-500 bg-amber-500/10 text-slate-900 shadow-sm ring-1 ring-amber-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs transition-colors",
                        isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <Church className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black leading-tight text-slate-900 truncate">
                        {branch.name}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 capitalize mt-0.5">
                        Access: {branch.role}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                      isSelected ? "border-amber-500 bg-amber-500 text-slate-950" : "border-slate-300 bg-white"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleProceedWithBranch}
            disabled={!selectedBranchId || selectingBranch}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 px-4 text-xs font-black uppercase tracking-wider text-slate-950 shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {selectingBranch ? "Entering Branch..." : "Enter Branch Sanctuary"}
            <ChevronRight className="h-4 w-4 stroke-[2.5]" />
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Sign in with a different account
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {isExpired && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-4 text-amber-950 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                <Clock className="h-4 w-4 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Session Expired
                </p>
                <p className="text-xs font-medium text-amber-800 mt-0.5 leading-relaxed">
                  Your session has expired. Please sign in again.
                </p>
              </div>
            </div>
          )}

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
      )}

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
