import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { StaffsClient } from "./staffs-client";

export const metadata = { title: "Staff Management" };

export default async function StaffsPage() {
  const { church, role, user } = await requireChurch();
  await requireModule("staffs");

  const isAdmin = role === "admin";

  const [rows, assignments] = await Promise.all([
    db
      .select({ s: schema.staff, name: schema.user.name })
      .from(schema.staff)
      .leftJoin(schema.user, eq(schema.user.id, schema.staff.userId))
      .where(eq(schema.staff.churchId, church.id))
      .orderBy(desc(schema.staff.createdAt)),
    db
      .select({ staffId: schema.staffModule.staffId, module: schema.staffModule.module })
      .from(schema.staffModule)
      .where(eq(schema.staffModule.churchId, church.id)),
  ]);

  // Group module assignments by staffId
  const byStaff = new Map<string, string[]>();
  for (const a of assignments) {
    byStaff.set(a.staffId, [...(byStaff.get(a.staffId) ?? []), a.module]);
  }

  const active = rows
    .filter((r) => r.s.status === "active" || r.s.status === "suspended")
    .map((r) => ({
      id: r.s.id,
      name: r.name ?? "Staff Member",
      email: r.s.email,
      role: r.s.role,
      twoFactorMethod: r.s.twoFactorMethod,
      joined: r.s.createdAt.toISOString(),
      self: r.s.userId === user.id,
      status: r.s.status,
      modules: byStaff.get(r.s.id) ?? [],
    }));

  const pending = rows
    .filter((r) => r.s.status === "pending")
    .map((r) => ({
      id: r.s.id,
      email: r.s.email,
      role: r.s.role,
      twoFactorMethod: r.s.twoFactorMethod,
      invited: r.s.createdAt.toISOString(),
      modules: byStaff.get(r.s.id) ?? [],
    }));

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-500">
      <StaffsClient isAdmin={isAdmin} active={active} pending={pending} />
    </div>
  );
}
