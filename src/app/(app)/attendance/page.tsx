import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { AttendanceGate } from "./gate";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Attendance Gate" };

const { event, member, attendance } = schema;

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const { church } = await requireChurch();
  await requireModule("events");
  const sp = await searchParams;

  // Events from the last 30 days and the next 7, newest first.
  const events = await db
    .select({ id: event.id, title: event.title, startsAt: event.startsAt })
    .from(event)
    .where(
      and(
        eq(event.churchId, church.id),
        sql`${event.startsAt} between current_date - 30 and current_date + 8`,
      ),
    )
    .orderBy(desc(event.startsAt));

  const eventId = typeof sp.event === "string" && events.some((e) => e.id === sp.event) ? sp.event : "";

  const [members, checkedIn] = await Promise.all([
    db
      .select({ id: member.id, fullName: member.fullName, phone: member.phone, category: member.category })
      .from(member)
      .where(and(eq(member.churchId, church.id), eq(member.active, true)))
      .orderBy(asc(member.fullName)),
    eventId
      ? db.select({ memberId: attendance.memberId }).from(attendance).where(eq(attendance.eventId, eventId))
      : Promise.resolve([]),
  ]);

  return (
    <AttendanceGate
      events={events.map((e) => ({
        id: e.id,
        label: `${e.title} · ${new Date(e.startsAt.replace(" ", "T")).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`,
      }))}
      eventId={eventId}
      members={members}
      checkedIn={checkedIn.map((c) => c.memberId)}
    />
  );
}
