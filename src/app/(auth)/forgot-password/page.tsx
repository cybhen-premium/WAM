import { db } from "@/db";
import { ForgotPasswordWrapper } from "./forgot-password-wrapper";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  let churchData = null;
  try {
    churchData = await db.query.church.findFirst();
  } catch (err) {
    console.warn("[ForgotPasswordPage] Unable to fetch church branding:", err);
  }

  return <ForgotPasswordWrapper logoUrl={churchData?.logoUrl} />;
}
