import "server-only";
import { and, eq, or, sql, type AnyColumn } from "drizzle-orm";
import { schema } from "@/db";

const { member } = schema;

/** Active members absent for 3 weeks within a month, or longer than the church's absence threshold. */
export function atRiskWhere(church: { id: string; absenceThresholdWeeks: number }) {
  const daysThreshold = (church.absenceThresholdWeeks || 3) * 7;
  return and(
    eq(member.churchId, church.id),
    eq(member.active, true),
    sql`${member.category} not in ('Visitor', 'Regular Attendee')`,
    or(
      // Last attended date is 3+ weeks ago
      sql`${member.lastAttendedAt} is not null and ${member.lastAttendedAt} < current_date - ${daysThreshold}::int`,
      // Joined 3+ weeks ago but has never attended
      sql`${member.lastAttendedAt} is null and ${member.joinedAt} is not null and ${member.joinedAt} < current_date - ${daysThreshold}::int`,
      // Logged as absent 3 or more times within the last 30 days
      sql`${member.id} in (
        select member_id from attendance 
        where church_id = ${church.id}
          and status = 'absent' 
          and service_date >= current_date - interval '30 days'
        group by member_id 
        having count(*) >= 3
      )`,
    ),
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
