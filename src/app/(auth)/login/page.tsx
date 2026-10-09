import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";
import { db } from "@/db";

export default async function LoginPage() {
  const churchData = await db.query.church.findFirst();

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
