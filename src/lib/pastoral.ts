import "server-only";
import { and, eq, sql, type AnyColumn } from "drizzle-orm";
import { schema } from "@/db";

const { member } = schema;

/** Active members absent for longer than the church's threshold (Settings → Preferences). */
export function atRiskWhere(church: { id: string; absenceThresholdWeeks: number }) {
  return and(
    eq(member.churchId, church.id),
    eq(member.active, true),
    sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
    sql`${member.lastAttendedAt} is not null and ${member.lastAttendedAt} < current_date - ${church.absenceThresholdWeeks * 7}::int`,
  );
}

/** Month-day of a date column equals today. */
export const isToday = (col: AnyColumn) => sql`to_char(${col}, 'MM-DD') = to_char(current_date, 'MM-DD')`;

/** Date column falls in the current calendar month (any year). */
export const isThisMonth = (col: AnyColumn) => sql`extract(month from ${col}) = extract(month from current_date)`;

/** Fills the [Name] tag in a welfare template with the member's first name. */
export function fillTemplate(template: string, fullName: string) {
  return template.replace(/\[name\]/gi, fullName.split(/\s+/)[0] ?? fullName);
}
