import { redirect } from "next/navigation";
import { landingHref } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Sends the user to the dashboard, or to the first module they were given access to.
  redirect(await landingHref());
}
