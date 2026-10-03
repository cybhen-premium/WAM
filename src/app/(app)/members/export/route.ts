import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { logActivity } from "@/lib/activity";

const COLUMNS = [
  ["Full Name", "fullName"],
  ["Phone", "phone"],
  ["Email", "email"],
  ["Gender", "gender"],
  ["Category", "category"],
  ["Baptized", "baptized"],
  ["Marital Status", "maritalStatus"],
  ["Occupation", "occupation"],
  ["Skills", "skills"],
  ["Address", "address"],
  ["Emergency Contact Name", "emergencyContactName"],
  ["Emergency Contact Phone", "emergencyContactPhone"],
  ["Date Of Birth", "dateOfBirth"],
  ["Wedding Anniversary", "weddingAnniversary"],
  ["Active", "active"],
  ["Photo URL", "photoUrl"],
] as const;

export async function GET() {
  const { church } = await requireChurch();
  const rows = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.churchId, church.id))
    .orderBy(asc(schema.member.fullName));

  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    COLUMNS.map(([h]) => h).join(","),
    ...rows.map((r) => COLUMNS.map(([, k]) => esc(r[k])).join(",")),
  ].join("\n");

  logActivity({
    module: "members",
    actionCode: "members.export",
    action: `Exported ${rows.length} members to CSV`,
    metadata: { count: rows.length },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
