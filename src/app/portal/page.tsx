import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMemberSession, MEMBER_SESSION_COOKIE } from "@/lib/member-portal";
import { MemberPortalClient } from "./portal-client";

export const metadata = {
  title: "Member Portal Dashboard",
  description: "View your tithes, welfare contributions, and personal profile.",
};

export default async function MemberPortalDashboardPage() {
  const cookieStore = await cookies();
  const hadCookie = cookieStore.has(MEMBER_SESSION_COOKIE);
  const session = await getMemberSession();
  if (!session) {
    if (hadCookie) {
      redirect("/portal/login?reason=timeout");
    }
    redirect("/portal/login");
  }

  const { member, church } = session;

  // Fetch department if assigned
  let departmentName: string | null = null;
  if (member.departmentId) {
    const [dept] = await db
      .select({ name: schema.department.name })
      .from(schema.department)
      .where(eq(schema.department.id, member.departmentId))
      .limit(1);
    if (dept) departmentName = dept.name;
  }

  // Fetch Member's Tithes
  const tithes = await db
    .select({
      id: schema.tithe.id,
      amount: schema.tithe.amount,
      week: schema.tithe.week,
      month: schema.tithe.month,
      createdAt: schema.tithe.createdAt,
    })
    .from(schema.tithe)
    .where(and(eq(schema.tithe.memberId, member.id), eq(schema.tithe.churchId, church.id)))
    .orderBy(desc(schema.tithe.month), desc(schema.tithe.week));

  // Fetch Member's Welfare Dues
  const welfare = await db
    .select({
      id: schema.welfareDues.id,
      amount: schema.welfareDues.amount,
      date: schema.welfareDues.date,
    })
    .from(schema.welfareDues)
    .where(and(eq(schema.welfareDues.memberId, member.id), eq(schema.welfareDues.churchId, church.id)))
    .orderBy(desc(schema.welfareDues.date));

  // Fetch Member's Inquiries & Support Messages
  const inquiries = await db
    .select({
      id: schema.memberInquiry.id,
      subject: schema.memberInquiry.subject,
      category: schema.memberInquiry.category,
      message: schema.memberInquiry.message,
      status: schema.memberInquiry.status,
      reply: schema.memberInquiry.reply,
      repliedBy: schema.memberInquiry.repliedBy,
      repliedAt: schema.memberInquiry.repliedAt,
      createdAt: schema.memberInquiry.createdAt,
    })
    .from(schema.memberInquiry)
    .where(and(eq(schema.memberInquiry.memberId, member.id), eq(schema.memberInquiry.churchId, church.id)))
    .orderBy(desc(schema.memberInquiry.createdAt));

  // Fetch Member Notifications
  const notifications = await db
    .select({
      id: schema.memberNotification.id,
      title: schema.memberNotification.title,
      message: schema.memberNotification.message,
      type: schema.memberNotification.type,
      read: schema.memberNotification.read,
      createdAt: schema.memberNotification.createdAt,
    })
    .from(schema.memberNotification)
    .where(eq(schema.memberNotification.memberId, member.id))
    .orderBy(desc(schema.memberNotification.createdAt));

  return (
    <MemberPortalClient
      member={{
        ...member,
        departmentName,
      }}
      church={{
        id: church.id,
        name: church.name,
        logoUrl: church.logoUrl,
        phone: church.phone,
      }}
      tithes={tithes}
      welfare={welfare}
      inquiries={inquiries}
      notifications={notifications}
    />
  );
}
