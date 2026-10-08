import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule, isBranchWithDisabledAdmin } from "@/lib/permissions";
import { StaffsClient } from "./staffs-client";

export const metadata = { title: "Staff Management" };

export default async function StaffsPage() {
  const { church, role, user, availableBranches } = await requireChurch();
  if (isBranchWithDisabledAdmin(church.name)) {
    redirect("/dashboard");
  }
  await requireModule("staffs");

  const isAdmin = role === "admin";
  const branchIds = availableBranches.map((b) => b.id);
  const targetBranchIds = branchIds.length > 0 ? branchIds : [church.id];

  const [rawRows, assignments, allUserBranches] = await Promise.all([
    db
      .select({ s: schema.staff, name: schema.user.name })
      .from(schema.staff)
      .leftJoin(schema.user, eq(schema.user.id, schema.staff.userId))
      .where(inArray(schema.staff.churchId, targetBranchIds))
      .orderBy(desc(schema.staff.createdAt)),
    db
      .select({ staffId: schema.staffModule.staffId, module: schema.staffModule.module })
      .from(schema.staffModule)
      .where(inArray(schema.staffModule.churchId, targetBranchIds)),
    db
      .select({
        userId: schema.staff.userId,
        churchId: schema.staff.churchId,
        churchName: schema.church.name,
      })
      .from(schema.staff)
      .innerJoin(schema.church, eq(schema.staff.churchId, schema.church.id))
      .where(eq(schema.staff.status, "active")),
  ]);

  // Group module assignments by staffId
  const byStaff = new Map<string, string[]>();
  for (const a of assignments) {
    byStaff.set(a.staffId, [...(byStaff.get(a.staffId) ?? []), a.module]);
  }

  // Deduplicate rows by user so staff assigned to multiple branches only appear once
  const rows: typeof rawRows = [];
  const seenUsers = new Set<string>();
  for (const r of rawRows) {
    const key = r.s.userId || r.s.email;
    if (!seenUsers.has(key)) {
      seenUsers.add(key);
      rows.push(r);
    }
  }

  // Group branches by userId
  const branchesByUser = new Map<string, Array<{ id: string; name: string }>>();
  for (const b of allUserBranches) {
    if (!b.userId) continue;
    const list = branchesByUser.get(b.userId) ?? [];
    if (!list.some((x) => x.id === b.churchId)) {
      list.push({ id: b.churchId, name: b.churchName });
    }
    branchesByUser.set(b.userId, list);
  }

  const active = rows
    .filter((r) => r.s.status === "active" || r.s.status === "suspended")
    .map((r) => ({
      id: r.s.id,
      userId: r.s.userId ?? undefined,
      name: r.name ?? "Staff Member",
      email: r.s.email,
      role: r.s.role,
      twoFactorMethod: r.s.twoFactorMethod,
      joined: r.s.createdAt.toISOString(),
      self: r.s.userId === user.id,
      status: r.s.status,
      modules: byStaff.get(r.s.id) ?? [],
      assignedBranches: (r.s.userId ? branchesByUser.get(r.s.userId) : null) ?? [
        { id: church.id, name: church.name },
      ],
    }));

  const pending = rows
    .filter((r) => r.s.status === "pending")
    .map((r) => ({
      id: r.s.id,
      userId: r.s.userId ?? undefined,
      email: r.s.email,
      role: r.s.role,
      twoFactorMethod: r.s.twoFactorMethod,
      invited: r.s.createdAt.toISOString(),
      modules: byStaff.get(r.s.id) ?? [],
      assignedBranches: [{ id: church.id, name: church.name }],
    }));

  return (
    <div className="space-y-6 pb-6 animate-in fade-in duration-500">
      <StaffsClient
        isAdmin={isAdmin}
        active={active}
        pending={pending}
        availableBranches={availableBranches}
        currentBranch={{ id: church.id, name: church.name }}
      />
    </div>
  );
}
