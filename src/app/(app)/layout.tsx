import { AppShell } from "@/components/app-shell";
import { requireChurch } from "@/lib/session";
import { getMyPermissions, MODULE_KEYS } from "@/lib/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { church, availableBranches, role, user, assignedDepartment, isShepherd } = await requireChurch();
  const perms = await getMyPermissions();

  const isAdmin = role === "admin" || perms === "all" || church.ownerId === user.id;

  return (
    <AppShell
      churchName={church.name}
      currentBranchId={church.id}
      availableBranches={availableBranches}
      logoUrl={church.logoUrl ?? undefined}
      smsCredits={church.smsCredits}
      modules={perms === "all" ? MODULE_KEYS : [...perms]}
      isAdmin={isAdmin}
      assignedDepartment={assignedDepartment}
      isShepherd={isShepherd}
    >
      {children}
    </AppShell>
  );
}

