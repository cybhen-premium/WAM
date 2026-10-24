import { AuthCard, DEFAULT_CHURCH_LOGO } from "@/components/auth-card";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { SetupTwoFactorForm } from "./setup-2fa-form";

export const metadata = {
  title: "Set Up Two-Factor Authentication",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Set Up Two-Factor Authentication",
    description: "Secure your church leadership account with two-factor authentication.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "World Ark Missions Logo" }],
  },
  twitter: {
    card: "summary",
    images: ["/logo.png"],
  },
};

export default async function SetupTwoFactorPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();

  // Already set up — nothing to do
  if (user.twoFactorEnabled) {
    redirect(searchParams.next || "/");
  }

  // Fetch church branding
  let churchLogo: string | null = null;
  try {
    const ch = await db.query.church.findFirst();
    churchLogo = ch?.logoUrl ?? null;
  } catch {
    // fallback
  }
  const logoUrl = churchLogo || DEFAULT_CHURCH_LOGO;

  // Check staff table first
  const [staffRow] = await db
    .select({ twoFactorMethod: schema.staff.twoFactorMethod })
    .from(schema.staff)
    .where(eq(schema.staff.userId, user.id))
    .limit(1);

  if (staffRow) {
    // Regular staff member
    if (staffRow.twoFactorMethod === "none") {
      redirect(searchParams.next || "/");
    }
    return (
      <AuthCard
        title="Set Up Two-Factor Authentication"
        subtitle={`Your administrator requires you to set up ${staffRow.twoFactorMethod === "totp" ? "an Authenticator App" : "Email 2FA"} before continuing.`}
        logoUrl={logoUrl}
      >
        <SetupTwoFactorForm mandatedMethod={staffRow.twoFactorMethod} />
      </AuthCard>
    );
  }

  // Super admin (church owner) — check the church-level 2FA setting
  const [churchRow] = await db
    .select({ ownerTwoFactorMethod: schema.church.ownerTwoFactorMethod, logoUrl: schema.church.logoUrl })
    .from(schema.church)
    .where(eq(schema.church.ownerId, user.id))
    .limit(1);

  if (!churchRow || churchRow.ownerTwoFactorMethod === "none") {
    redirect(searchParams.next || "/");
  }

  return (
    <AuthCard
      title="Set Up Two-Factor Authentication"
      subtitle={`Secure your super admin account with ${churchRow.ownerTwoFactorMethod === "totp" ? "an Authenticator App" : "Email 2FA"}.`}
      logoUrl={churchRow.logoUrl || logoUrl}
    >
      <SetupTwoFactorForm mandatedMethod={churchRow.ownerTwoFactorMethod} />
    </AuthCard>
  );
}
