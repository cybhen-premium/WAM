import { Suspense } from "react";
import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { ShepherdLoginForm } from "./login-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shepherd Portal Sign In",
  description: "Sign in to manage your discipleship flock and service attendance.",
};

export default async function ShepherdLoginPage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[ShepherdLoginPage] Unable to fetch church branding:", err);
  }

  return (
    <AuthCard
      title="Shepherd Portal"
      subtitle={churchData?.name ? `Discipleship & Pastoral Care • ${churchData.name}` : "Discipleship & Pastoral Care"}
      logoUrl={churchData?.logoUrl || DEFAULT_CHURCH_LOGO}
    >
      <Suspense>
        <ShepherdLoginForm />
      </Suspense>
    </AuthCard>
  );
}
