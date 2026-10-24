import { Suspense } from "react";
import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { TwoFactorForm } from "./two-factor-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Two-Factor Authentication",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Two-Factor Authentication",
    description: "Enter your verification code to complete login.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "World Ark Missions Logo" }],
  },
  twitter: {
    card: "summary",
    images: ["/logo.png"],
  },
};

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
      logoUrl={churchData?.logoUrl || DEFAULT_CHURCH_LOGO}
    >
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}
