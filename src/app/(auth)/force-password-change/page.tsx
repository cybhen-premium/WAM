import { Suspense } from "react";
import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { ForcePasswordForm } from "./force-password-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create New Password",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Create New Password",
    description: "Set a new secure password for your account.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "World Ark Missions Logo" }],
  },
  twitter: {
    card: "summary",
    images: ["/logo.png"],
  },
};

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
      logoUrl={churchData?.logoUrl || DEFAULT_CHURCH_LOGO}
    >
      <Suspense>
        <ForcePasswordForm />
      </Suspense>
    </AuthCard>
  );
}
