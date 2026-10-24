import { Suspense } from "react";
import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { ShepherdLoginForm } from "./login-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shepherd Portal Sign In",
  description: "Sign in to manage your discipleship flock and service attendance.",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Shepherd Portal",
    description: "Sign in to manage your discipleship flock and service attendance.",
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
    title: "World Ark Missions • Shepherd Portal",
    description: "Sign in to manage your discipleship flock and service attendance.",
    images: ["/logo.png"],
  },
};

export default async function ShepherdLoginPage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[ShepherdLoginPage] Unable to fetch church branding:", err);
  }

  // Remove only "Holy Spirit Citadel" from the church name
  const churchName = churchData?.name
    ? churchData.name.replace(/\s*[-–—]?\s*Holy Spirit Citadel/i, "").trim()
    : "World Ark Missions";

  return (
    <AuthCard
      title="Shepherd Portal"
      subtitle={`Discipleship & Pastoral Care • ${churchName || "World Ark Missions"}`}
      logoUrl={churchData?.logoUrl || DEFAULT_CHURCH_LOGO}
    >
      <Suspense>
        <ShepherdLoginForm />
      </Suspense>
    </AuthCard>
  );
}
