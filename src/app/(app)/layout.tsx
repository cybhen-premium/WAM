import { AppShell } from "@/components/app-shell";
import { requireChurch } from "@/lib/session";
import { PLAN_CREDITS } from "@/lib/utils";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { church } = await requireChurch();
  return (
    <AppShell
      churchName={church.name}
      logoUrl={church.logoUrl ?? undefined}
      smsCredits={church.smsCredits}
      creditLimit={Math.max(PLAN_CREDITS[church.plan] ?? 20, church.smsCredits)}
    >
      {children}
    </AppShell>
  );
}
