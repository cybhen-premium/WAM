import { db } from "@/db";
import { DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { ForgotPasswordWrapper } from "./forgot-password-wrapper";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Forgot Password",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Forgot Password",
    description: "Recover access to your church account.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "World Ark Missions Logo" }],
  },
  twitter: {
    card: "summary",
    images: ["/logo.png"],
  },
};

export default async function ForgotPasswordPage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[ForgotPasswordPage] Unable to fetch church branding:", err);
  }

  return <ForgotPasswordWrapper logoUrl={churchData?.logoUrl || DEFAULT_CHURCH_LOGO} />;
}
