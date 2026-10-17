"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Smartphone, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Field, SubmitButton } from "@/components/auth-card";
import { loginShepherd } from "./actions";

export function ShepherdLoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your Phone number, Email, or Shepherd Code.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    startTransition(async () => {
      const res = await loginShepherd(identifier, password);
      if (!res.ok) {
        toast.error(res.error || "Login failed.");
        return;
      }
      toast.success("Welcome back! Signing in to Shepherd Portal...");
      router.push("/shepherd-portal");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label="Phone, Email, or Shepherd ID"
        name="identifier"
        type="text"
        required
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        icon={<Smartphone />}
        placeholder="e.g. 0244123456 or SHP-8K2X"
      />

      <Field
        label="Password"
        name="password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        icon={<Lock />}
        placeholder="••••••••"
      />

      <SubmitButton pending={pending}>
        <span className="inline-flex items-center justify-center gap-2">
          <span>Access Shepherd Portal</span>
          <ArrowRight className="h-4 w-4" />
        </span>
      </SubmitButton>

      <div className="pt-3 text-center space-y-2 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          Need access or forgot password?{" "}
          <span className="font-semibold text-slate-700">Contact church office</span>
        </p>

        <p className="text-xs">
          <Link
            href="/login"
            className="font-bold text-[#1E3A8A] hover:underline inline-flex items-center gap-1"
          >
            <span>Are you church staff or admin? Sign in here</span> →
          </Link>
        </p>
      </div>
    </form>
  );
}
