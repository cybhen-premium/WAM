import { db } from "@/db";
import { ForgotPasswordWrapper } from "./forgot-password-wrapper";

export default async function ForgotPasswordPage() {
  const churchData = await db.query.church.findFirst();

  return <ForgotPasswordWrapper logoUrl={churchData?.logoUrl} />;
}
