import { AppShell } from "@/components/app-shell";
import { requireChurch } from "@/lib/session";
import { getMyPermissions, MODULE_KEYS } from "@/lib/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { church, availableBranches } = await requireChurch();
  // "all" for superadmins, otherwise only the modules assigned to this user.
  const perms = await getMyPermissions();
  return (
    <AppShell
      churchName={church.name}
      currentBranchId={church.id}
      availableBranches={availableBranches}
      logoUrl={church.logoUrl ?? undefined}
      smsCredits={church.smsCredits}
      modules={perms === "all" ? MODULE_KEYS : [...perms]}
    >
      {children}
    </AppShell>
  );
}
