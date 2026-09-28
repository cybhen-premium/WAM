import { AppShell } from "@/components/app-shell";
import { requireChurch } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { church } = await requireChurch();
  return (
    <AppShell
      churchName={church.name}
      logoUrl={church.logoUrl ?? undefined}
      smsCredits={church.smsCredits}
    >
      {children}
    </AppShell>
  );
}
