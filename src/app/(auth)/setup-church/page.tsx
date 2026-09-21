import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Church } from "lucide-react";
import { db, schema } from "@/db";
import { AuthCard } from "@/components/auth-card";
import { getChurchForUser, requireUser } from "@/lib/session";
import { acceptInvite } from "./actions";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up your church" };

export default async function SetupChurchPage({ searchParams }: PageProps<"/setup-church">) {
  const user = await requireUser();
  if (await getChurchForUser(user.id)) redirect("/dashboard");
  const sp = await searchParams;

  const invites = await db
    .select({ id: schema.staff.id, role: schema.staff.role, churchName: schema.church.name })
    .from(schema.staff)
    .innerJoin(schema.church, eq(schema.church.id, schema.staff.churchId))
    .where(and(eq(schema.staff.email, user.email.toLowerCase()), eq(schema.staff.status, "pending")));

  return (
    <AuthCard title="Welcome to EcclesiaSync" subtitle="Let's set up your sanctuary">
      {invites.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="px-1 text-[10px] font-extrabold uppercase tracking-tight text-emerald-600">You&apos;ve been invited</p>
          {invites.map((i) => (
            <form key={i.id} action={acceptInvite.bind(null, i.id)} className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <Church className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{i.churchName}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">as {i.role}</p>
              </div>
              <button className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700">Join</button>
            </form>
          ))}
          <p className="pt-2 text-center text-xs text-slate-400">or create a new church below</p>
        </div>
      )}
      <SetupForm referralCode={typeof sp.ref === "string" ? sp.ref : ""} />
    </AuthCard>
  );
}
