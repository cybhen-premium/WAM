import { Suspense } from "react";
import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { MemberLoginForm } from "./login-form";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Member Portal Sign In",
  description: "Sign into your church member portal to view your tithes, welfare dues, and update your profile.",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Member Portal",
    description: "Sign into your church member portal to view your tithes, welfare dues, and update your profile.",
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
    title: "World Ark Missions • Member Portal",
    description: "Sign into your church member portal to view your tithes, welfare dues, and update your profile.",
    images: ["/logo.png"],
  },
};

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isTimedOut = params?.reason === "timeout" || params?.expired === "true";
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[MemberLoginPage] Unable to fetch church branding:", err);
  }

  return (
    <AuthCard
      title="Member Portal"
      subtitle={
        churchData?.name
          ? `Member Self-Service • ${churchData.name}`
          : "Sign in with your Member ID or phone number"
      }
      logoUrl={churchData?.logoUrl || DEFAULT_CHURCH_LOGO}
    >
      {isTimedOut && (
        <div className="mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 flex items-start gap-3 text-amber-900 animate-in fade-in duration-200">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700">
            <span className="font-bold">!</span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-amber-950">
              Session Expired
            </p>
            <p className="text-xs text-amber-800 font-medium mt-0.5 leading-relaxed">
              Your session timed out due to inactivity. Please sign in again.
            </p>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="h-36 rounded-2xl bg-slate-50 animate-pulse" />}>
        <MemberLoginForm
          defaultLogoUrl={churchData?.logoUrl}
          defaultChurchName={churchData?.name}
        />
      </Suspense>
    </AuthCard>
  );
}
