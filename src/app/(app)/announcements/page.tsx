import { and, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { atRiskWhere } from "@/lib/pastoral";
import { Composer } from "./composer";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Announcements" };

const { member, department } = schema;

export default async function AnnouncementsPage({ searchParams }: PageProps<"/announcements">) {
  const { church } = await requireChurch();
  await requireModule("announcements");
  const sp = await searchParams;
  const initialAudience = typeof sp.audience === "string" ? sp.audience : undefined;

  const [[totalMembers], depts, [atRisk]] = await Promise.all([
    // Entire congregation: active church members (excluding visitors & regular attendees)
    db
      .select({ n: count() })
      .from(member)
      .where(
        and(
          eq(member.churchId, church.id),
          eq(member.active, true),
          sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
        ),
      ),
    // Departments: count active church members in each department
    db
      .select({
        id: department.id,
        name: department.name,
        n: count(member.id),
      })
      .from(department)
      .leftJoin(
        member,
        and(
          eq(member.departmentId, department.id),
          eq(member.churchId, church.id),
          eq(member.active, true),
          sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
        ),
      )
      .where(eq(department.churchId, church.id))
      .groupBy(department.id, department.name)
      .orderBy(department.name),
    db.select({ n: count() }).from(member).where(atRiskWhere(church)),
  ]);

  const audiences = [
    { value: "all", label: "Entire Congregation", count: totalMembers.n },
    ...depts.map((d) => ({ value: `dept:${d.id}`, label: d.name, count: d.n })),
    ...(atRisk.n ? [{ value: "at-risk", label: "At-Risk Members", count: atRisk.n }] : []),
  ];

  return <Composer credits={church.smsCredits} audiences={audiences} initialAudience={initialAudience} />;
}
