import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { TwoFactorForm } from "./two-factor-form";
import { db } from "@/db";

export default async function TwoFactorPage() {
  const churchData = await db.query.church.findFirst();

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
