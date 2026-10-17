import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { requireModule } from "@/lib/permissions";
import { ShepherdsClient } from "./shepherds-client";

export const metadata = {
  title: "Shepherds & Disciples",
  description: "Discipleship tracking, flock management, and spiritual walk evaluations.",
};

export default async function ShepherdsAdminPage() {
  const { church } = await requireChurch();
  await requireModule("shepherds");

  // 1. Fetch all registered shepherds with disciple counts and linked staff role
  const shepherds = await db
    .select({
      id: schema.shepherd.id,
      staffId: schema.shepherd.staffId,
      fullName: schema.shepherd.fullName,
      phone: schema.shepherd.phone,
      email: schema.shepherd.email,
      shepherdCode: schema.shepherd.shepherdCode,
      active: schema.shepherd.active,
      notes: schema.shepherd.notes,
      createdAt: schema.shepherd.createdAt,
      discipleCount: sql<number>`coalesce(count(${schema.shepherdDisciple.id}) filter (where ${schema.shepherdDisciple.active} = true), 0)::int`,
      staffRole: schema.staff.role,
    })
    .from(schema.shepherd)
    .leftJoin(
      schema.staff,
      eq(schema.staff.id, schema.shepherd.staffId)
    )
    .leftJoin(
      schema.shepherdDisciple,
      eq(schema.shepherdDisciple.shepherdId, schema.shepherd.id)
    )
    .where(eq(schema.shepherd.churchId, church.id))
    .groupBy(schema.shepherd.id, schema.staff.role)
    .orderBy(desc(schema.shepherd.createdAt));

  // 2. Fetch all candidates from members and SOB with current shepherd assignment (if any)
  const candidates = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      photoUrl: schema.member.photoUrl,
      category: schema.member.category,
      fromAkwaaba: schema.member.fromAkwaaba,
      currentShepherdId: schema.shepherdDisciple.shepherdId,
      currentShepherdName: schema.shepherd.fullName,
    })
    .from(schema.member)
    .leftJoin(
      schema.shepherdDisciple,
      and(
        eq(schema.shepherdDisciple.memberId, schema.member.id),
        eq(schema.shepherdDisciple.churchId, church.id),
        eq(schema.shepherdDisciple.active, true)
      )
    )
    .leftJoin(
      schema.shepherd,
      eq(schema.shepherd.id, schema.shepherdDisciple.shepherdId)
    )
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.active, true)
      )
    )
    .orderBy(schema.member.fullName);

  // 3. Fetch active staff members to allow picking from staff when creating shepherds
  const staffMembers = await db
    .select({
      id: schema.staff.id,
      userId: schema.staff.userId,
      name: schema.user.name,
      email: schema.staff.email,
      role: schema.staff.role,
    })
    .from(schema.staff)
    .leftJoin(schema.user, eq(schema.user.id, schema.staff.userId))
    .where(and(eq(schema.staff.churchId, church.id), eq(schema.staff.status, "active")))
    .orderBy(schema.user.name, schema.staff.email);

  return (
    <ShepherdsClient
      shepherds={shepherds}
      allCandidates={candidates}
      staffMembers={staffMembers}
    />
  );
}
