import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { ForcePasswordForm } from "./force-password-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function ForcePasswordChangePage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[ForcePasswordChangePage] Unable to fetch church branding:", err);
  }

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
