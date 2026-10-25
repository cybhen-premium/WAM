import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireShepherd, verifyPassword } from "@/lib/shepherd-portal";
import { ShepherdPortalClient } from "./portal-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shepherd Portal",
  description: "Discipleship tracking, attendance roll-call, and spiritual walk evaluations.",
  openGraph: {
    type: "website",
    title: "World Ark Missions • Shepherd Portal",
    description: "Discipleship tracking, attendance roll-call, and spiritual walk evaluations.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "World Ark Missions Logo",
        type: "image/png",
      },
      {
        url: "https://res.cloudinary.com/dm5bp1efp/image/upload/v1792173363/churchy/branding/noka8l1kbu6jz0zuzrva.png",
        width: 512,
        height: 512,
        alt: "World Ark Missions Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "World Ark Missions • Shepherd Portal",
    description: "Discipleship tracking, attendance roll-call, and spiritual walk evaluations.",
    images: ["/logo.png"],
  },
};

export default async function ShepherdPortalPage() {
  const { shepherd, church } = await requireShepherd();
  const isUsingInitialPassword = !shepherd.staffId && verifyPassword("WAM@2026", shepherd.passwordHash);

  // Fetch disciples, attendance history, and spiritual evaluations in parallel for speed
  const [disciples, recentAttendance, recentSpiritualLogs] = await Promise.all([
    // 1. Fetch active disciples assigned to this shepherd
    db
      .select({
        disciple: {
          id: schema.shepherdDisciple.id,
          source: schema.shepherdDisciple.source,
          assignedAt: schema.shepherdDisciple.assignedAt,
          notes: schema.shepherdDisciple.notes,
        },
        member: {
          id: schema.member.id,
          fullName: schema.member.fullName,
          phone: schema.member.phone,
          photoUrl: schema.member.photoUrl,
          category: schema.member.category,
          gender: schema.member.gender,
          fromAkwaaba: schema.member.fromAkwaaba,
        },
      })
      .from(schema.shepherdDisciple)
      .innerJoin(schema.member, eq(schema.member.id, schema.shepherdDisciple.memberId))
      .where(
        and(
          eq(schema.shepherdDisciple.churchId, church.id),
          eq(schema.shepherdDisciple.shepherdId, shepherd.id),
          eq(schema.shepherdDisciple.active, true)
        )
      )
      .orderBy(schema.member.fullName),

    // 2. Fetch recent attendance logs
    db
      .select({
        att: {
          id: schema.shepherdAttendance.id,
          serviceDate: schema.shepherdAttendance.serviceDate,
          serviceType: schema.shepherdAttendance.serviceType,
          customProgramName: schema.shepherdAttendance.customProgramName,
          status: schema.shepherdAttendance.status,
          notes: schema.shepherdAttendance.notes,
          memberId: schema.shepherdAttendance.memberId,
        },
        memberName: schema.member.fullName,
      })
      .from(schema.shepherdAttendance)
      .innerJoin(schema.member, eq(schema.member.id, schema.shepherdAttendance.memberId))
      .where(
        and(
          eq(schema.shepherdAttendance.churchId, church.id),
          eq(schema.shepherdAttendance.shepherdId, shepherd.id)
        )
      )
      .orderBy(desc(schema.shepherdAttendance.serviceDate), desc(schema.shepherdAttendance.createdAt))
      .limit(100),

    // 3. Fetch recent spiritual evaluation logs
    db
      .select({
        log: {
          id: schema.shepherdSpiritualLog.id,
          memberId: schema.shepherdSpiritualLog.memberId,
          logDate: schema.shepherdSpiritualLog.logDate,
          quietTimeConsistency: schema.shepherdSpiritualLog.quietTimeConsistency,
          quietTimeScripture: schema.shepherdSpiritualLog.quietTimeScripture,
          prayerLifeRating: schema.shepherdSpiritualLog.prayerLifeRating,
          prayerFocusNotes: schema.shepherdSpiritualLog.prayerFocusNotes,
          spiritualStatus: schema.shepherdSpiritualLog.spiritualStatus,
          shepherdRemarks: schema.shepherdSpiritualLog.shepherdRemarks,
        },
        memberName: schema.member.fullName,
      })
      .from(schema.shepherdSpiritualLog)
      .innerJoin(schema.member, eq(schema.member.id, schema.shepherdSpiritualLog.memberId))
      .where(
        and(
          eq(schema.shepherdSpiritualLog.churchId, church.id),
          eq(schema.shepherdSpiritualLog.shepherdId, shepherd.id)
        )
      )
      .orderBy(desc(schema.shepherdSpiritualLog.logDate), desc(schema.shepherdSpiritualLog.createdAt))
      .limit(50),
  ]);

  return (
    <ShepherdPortalClient
      shepherd={{
        id: shepherd.id,
        fullName: shepherd.fullName,
        phone: shepherd.phone,
        shepherdCode: shepherd.shepherdCode,
        email: shepherd.email,
        photoUrl: shepherd.photoUrl,
      }}
      church={{
        name: church.name,
        logoUrl: church.logoUrl,
      }}
      disciples={disciples}
      recentAttendance={recentAttendance}
      recentSpiritualLogs={recentSpiritualLogs}
      isStaffMember={Boolean(shepherd.staffId)}
      isUsingInitialPassword={isUsingInitialPassword}
    />
  );
}
