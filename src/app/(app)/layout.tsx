import { cache } from "react";
import { AppShell } from "@/components/app-shell";
import { requireChurch } from "@/lib/session";
import { getMyPermissions, MODULE_KEYS } from "@/lib/permissions";
import { db, schema } from "@/db";
import { and, eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

const checkIsShepherd = cache(
  async (churchId: string, staffId: string, email?: string | null): Promise<boolean> => {
    try {
      const matchOr = [];
      if (staffId) {
        matchOr.push(eq(schema.shepherd.staffId, staffId));
      }
      if (email) {
        matchOr.push(eq(schema.shepherd.email, email.toLowerCase()));
      }
      if (matchOr.length > 0) {
        const [shepherdRow] = await db
          .select({ id: schema.shepherd.id })
          .from(schema.shepherd)
          .where(
            and(
              eq(schema.shepherd.churchId, churchId),
              eq(schema.shepherd.active, true),
              or(...matchOr)
            )
          )
          .limit(1);
        return Boolean(shepherdRow);
      }
    } catch (err) {
      console.error("[AppLayout] Shepherd check error:", err);
    }
    return false;
  }
);

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { church, availableBranches, role, user, assignedDepartment, staffId } = await requireChurch();

  // Run permissions and shepherd check in parallel
  const [perms, isShepherd] = await Promise.all([
    getMyPermissions(),
    checkIsShepherd(church.id, staffId, user.email),
  ]);

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
