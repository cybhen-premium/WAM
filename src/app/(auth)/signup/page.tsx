import { db } from "@/db";
import { user } from "@/db/schema";
import { count } from "drizzle-orm";
import { AuthCard } from "@/components/auth-card";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  let userCount = 1;
  try {
    const result = await db.select({ value: count() }).from(user);
    userCount = result[0]?.value ?? 0;
  } catch (err) {
    console.warn("[SignupPage] Unable to check user count:", err);
  }

  if (userCount > 0) {
    return (
      <AuthCard title="Signups Disabled" subtitle="Personal Application">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <p className="text-center text-sm text-slate-500">
            Signups are currently disabled because an administrator account already exists.
          </p>
        </div>
      </AuthCard>
    );
  }

  return <SignupForm />;
}
