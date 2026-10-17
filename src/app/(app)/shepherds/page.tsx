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

  // 1. Fetch all registered shepherds with disciple counts
  const shepherds = await db
    .select({
      id: schema.shepherd.id,
      fullName: schema.shepherd.fullName,
      phone: schema.shepherd.phone,
      email: schema.shepherd.email,
      shepherdCode: schema.shepherd.shepherdCode,
      active: schema.shepherd.active,
      notes: schema.shepherd.notes,
      createdAt: schema.shepherd.createdAt,
      discipleCount: sql<number>`coalesce(count(${schema.shepherdDisciple.id}) filter (where ${schema.shepherdDisciple.active} = true), 0)::int`,
    })
    .from(schema.shepherd)
    .leftJoin(
      schema.shepherdDisciple,
      eq(schema.shepherdDisciple.shepherdId, schema.shepherd.id)
    )
    .where(eq(schema.shepherd.churchId, church.id))
    .groupBy(schema.shepherd.id)
    .orderBy(desc(schema.shepherd.createdAt));

  // 2. Fetch candidates from members and SOB
  const candidates = await db
    .select({
      id: schema.member.id,
      fullName: schema.member.fullName,
      phone: schema.member.phone,
      category: schema.member.category,
      fromAkwaaba: schema.member.fromAkwaaba,
    })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.churchId, church.id),
        eq(schema.member.active, true)
      )
    )
    .orderBy(schema.member.fullName);

  return <ShepherdsClient shepherds={shepherds} allCandidates={candidates} />;
}
