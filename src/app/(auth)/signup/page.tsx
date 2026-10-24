import { db } from "@/db";
import { user, church } from "@/db/schema";
import { count } from "drizzle-orm";
import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Account",
  description: "Create an administrator account for World Ark Missions church management.",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Get Started",
    description: "Create an administrator account for World Ark Missions church management.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "World Ark Missions Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "World Ark Missions • Get Started",
    description: "Create an administrator account for World Ark Missions church management.",
    images: ["/logo.png"],
  },
};

export default async function SignupPage() {
  let userCount = 1;
  let churchData = null;
  try {
    const [result, ch] = await Promise.all([
      db.select({ value: count() }).from(user),
      db.query.church.findFirst(),
    ]);
    userCount = result[0]?.value ?? 0;
    churchData = ch;
  } catch (err) {
    console.warn("[SignupPage] Unable to check user count:", err);
  }

  const logoUrl = churchData?.logoUrl || DEFAULT_CHURCH_LOGO;

  if (userCount > 0) {
    return (
      <AuthCard title="Signups Disabled" subtitle="Personal Application" logoUrl={logoUrl}>
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <p className="text-center text-sm text-slate-500">
            Signups are currently disabled because an administrator account already exists.
          </p>
        </div>
      </AuthCard>
    );
  }

  return <SignupForm logoUrl={logoUrl} />;
}
