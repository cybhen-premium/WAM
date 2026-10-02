import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { ForcePasswordForm } from "./force-password-form";
import { db } from "@/db";

export default async function ForcePasswordChangePage() {
  const churchData = await db.query.church.findFirst();

  return (
    <AuthCard
      title="Create New Password"
      subtitle="Your account requires you to set a new password before continuing."
      logoUrl={churchData?.logoUrl}
    >
      <Suspense>
        <ForcePasswordForm />
      </Suspense>
    </AuthCard>
  );
}
