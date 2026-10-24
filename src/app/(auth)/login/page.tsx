import { Suspense } from "react";
import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { LoginForm } from "./login-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In",
  description: "Sign in to World Ark Missions church management platform.",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Sign In",
    description: "Sign in to World Ark Missions church management platform.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "World Ark Missions Logo",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dm5bp1efp/image/upload/v1792173363/churchy/branding/noka8l1kbu6jz0zuzrva.png",
        width: 512,
        height: 512,
        alt: "World Ark Missions Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "World Ark Missions • Sign In",
    description: "Sign in to World Ark Missions church management platform.",
    images: ["/logo.png"],
  },
};

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
      logoUrl={churchData?.logoUrl || DEFAULT_CHURCH_LOGO}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
