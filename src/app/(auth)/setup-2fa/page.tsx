import { AuthCard } from "@/components/auth-card";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { SetupTwoFactorForm } from "./setup-2fa-form";

export const metadata = { title: "Set Up Two-Factor Authentication" };

export default async function SetupTwoFactorPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();

  // Already set up — nothing to do
  if (user.twoFactorEnabled) {
    redirect(searchParams.next || "/");
  }

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
      <AuthCard title="Set Up Two-Factor Authentication" subtitle={`Your administrator requires you to set up ${staffRow.twoFactorMethod === "totp" ? "an Authenticator App" : "Email 2FA"} before continuing.`}>
        <SetupTwoFactorForm mandatedMethod={staffRow.twoFactorMethod} />
      </AuthCard>
    );
  }

  // Super admin (church owner) — check the church-level 2FA setting
  const [churchRow] = await db
    .select({ ownerTwoFactorMethod: schema.church.ownerTwoFactorMethod })
    .from(schema.church)
    .where(eq(schema.church.ownerId, user.id))
    .limit(1);

  if (!churchRow || churchRow.ownerTwoFactorMethod === "none") {
    redirect(searchParams.next || "/");
  }

  return (
    <AuthCard title="Set Up Two-Factor Authentication" subtitle={`Secure your super admin account with ${churchRow.ownerTwoFactorMethod === "totp" ? "an Authenticator App" : "Email 2FA"}.`}>
      <SetupTwoFactorForm mandatedMethod={churchRow.ownerTwoFactorMethod} />
    </AuthCard>
  );
}
