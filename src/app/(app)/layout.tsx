import { AppShell } from "@/components/app-shell";
import { requireChurch } from "@/lib/session";
import { getMyPermissions, MODULE_KEYS } from "@/lib/permissions";
import { db, schema } from "@/db";
import { and, eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { church, availableBranches, role, user, assignedDepartment, staffId } = await requireChurch();
  // "all" for superadmins, otherwise only the modules assigned to this user.
  const perms = await getMyPermissions();
  const isAdmin = role === "admin" || perms === "all" || church.ownerId === user.id;

  // Check if current user is registered as a shepherd in this church
  let isShepherd = false;
  try {
    const matchOr = [];
    if (staffId) {
      matchOr.push(eq(schema.shepherd.staffId, staffId));
    }
    if (user.email) {
      matchOr.push(eq(schema.shepherd.email, user.email.toLowerCase()));
    }
    if (matchOr.length > 0) {
      const [shepherdRow] = await db
        .select({ id: schema.shepherd.id })
        .from(schema.shepherd)
        .where(
          and(
            eq(schema.shepherd.churchId, church.id),
            eq(schema.shepherd.active, true),
            or(...matchOr)
          )
        )
        .limit(1);
      if (shepherdRow) {
        isShepherd = true;
      }
    }
  } catch (err) {
    console.error("[AppLayout] Shepherd check error:", err);
  }

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
