import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { TwoFactorForm } from "./two-factor-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[TwoFactorPage] Unable to fetch church branding:", err);
  }

  return (
    <AuthCard
      title="Two-Factor Authentication"
      subtitle="Enter the verification code to continue."
      logoUrl={churchData?.logoUrl}
    >
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}
