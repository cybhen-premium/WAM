import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { atRiskWhere } from "@/lib/pastoral";
import { Composer } from "./composer";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Announcements" };

const { member } = schema;

export default async function AnnouncementsPage() {
  const { church } = await requireChurch();
  await requireModule("messaging");

  const [[all], categories, [atRisk]] = await Promise.all([
    db.select({ n: count() }).from(member).where(and(eq(member.churchId, church.id), eq(member.active, true))),
    db
      .select({ category: member.category, n: count() })
      .from(member)
      .where(and(eq(member.churchId, church.id), eq(member.active, true)))
      .groupBy(member.category)
      .orderBy(member.category),
    db.select({ n: count() }).from(member).where(atRiskWhere(church)),
  ]);

  const audiences = [
    { value: "all", label: "Entire Congregation", count: all.n },
    ...categories.map((c) => ({ value: `category:${c.category}`, label: c.category, count: c.n })),
    ...(atRisk.n ? [{ value: "at-risk", label: "At-Risk Members", count: atRisk.n }] : []),
  ];

  return <Composer credits={church.smsCredits} audiences={audiences} />;
}
