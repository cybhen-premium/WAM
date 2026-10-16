import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";
import { db } from "@/db";

export default async function LoginPage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[LoginPage] Unable to fetch church branding (database offline or quota reached):", err);
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to World Ark Missions"
      logoUrl={churchData?.logoUrl}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
