import { desc, eq } from "drizzle-orm";
import { CalendarClock, CircleCheck, CreditCard, History, ShieldCheck } from "lucide-react";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { PLANS, TOPUPS, paymentsConfigured } from "@/lib/billing";
import { cedis, cn, fmtDate } from "@/lib/utils";
import { PlanGrid, TopupButton } from "./billing-client";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { church } = await requireChurch();
  const sp = await searchParams;
  const flash = typeof sp.payment === "string" ? { ok: sp.ok === "1", text: sp.payment } : null;

  const payments = await db
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.churchId, church.id))
    .orderBy(desc(schema.payment.createdAt))
    .limit(50);

  const { renews, daysLeft } = cycleStatus(church.renewsAt, church.createdAt);
  const cycleDays = church.billingCycle === "yearly" ? 365 : 30;

  return (
    <div className="space-y-8 pb-16 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      {flash && (
        <p className={cn("rounded-2xl px-4 py-3 text-sm font-bold", flash.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
          {flash.text}
        </p>
      )}
      {!(await paymentsConfigured()) && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Online checkout is disabled until a platform admin sets up a payment provider in Settings → Integrations.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card icon={CreditCard} label="SMS Wallet" value={`${church.smsCredits} Units`} dark />
        <Card icon={ShieldCheck} label="Active Plan" value={church.plan.toUpperCase()} />
        <Card icon={CircleCheck} label="Billing Status" value={daysLeft > 0 ? "ACTIVE" : "EXPIRED"} tone={daysLeft > 0 ? "text-emerald-600" : "text-red-600"} />
        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-100">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" /> Cycle Progress
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">{daysLeft} Days Left</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#1e3a8a]" style={{ width: `${Math.min(100, (daysLeft / cycleDays) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
            Renews: {renews.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      <PlanGrid plans={PLANS} current={church.plan} supportEmail={process.env.SUPPORT_EMAIL} />

      <section>
        <h2 className="mb-4 text-[11px] font-black uppercase tracking-widest text-slate-500">One-Time Top-Up</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TOPUPS.map((t) => (
            <div key={t.id} className="rounded-[1.5rem] bg-white p-5 text-center shadow-sm border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.name}</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{t.credits.toLocaleString()}</p>
              <p className="text-xs font-bold text-slate-400">Units</p>
              <TopupButton id={t.id} label={`GHS ${t.price}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] bg-white shadow-sm border border-slate-100 overflow-hidden">
        <h2 className="flex items-center gap-2 px-6 pt-6 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <History className="h-4 w-4" /> Transaction History
        </h2>
        {payments.length === 0 ? (
          <p className="py-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">No transactions recorded yet</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-50">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                <div>
                  <p className="font-bold text-slate-800">
                    {p.kind === "plan" ? `${p.description.split(":")[0]} plan (${p.description.split(":")[1]})` : p.description}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {fmtDate(p.createdAt)} · {p.reference}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{cedis(p.amount)}</p>
                  <p
                    className={cn(
                      "text-[10px] font-black uppercase",
                      p.status === "paid" ? "text-emerald-600" : p.status === "failed" ? "text-red-600" : "text-amber-600",
                    )}
                  >
                    {p.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Renewal date and days left. Before the first paid renewal the cycle is 30 days from signup. */
function cycleStatus(renewsAt: string | null, createdAt: Date) {
  const renews = renewsAt ? new Date(renewsAt + "T00:00:00") : new Date(createdAt.getTime() + 30 * 86_400_000);
  return { renews, daysLeft: Math.max(0, Math.ceil((renews.getTime() - Date.now()) / 86_400_000)) };
}

function Card({ icon: Icon, label, value, dark, tone }: { icon: typeof CreditCard; label: string; value: string; dark?: boolean; tone?: string }) {
  return (
    <div className={cn("rounded-[1.5rem] p-5 shadow-sm", dark ? "bg-[#1e3a8a] text-white" : "bg-white border border-slate-100")}>
      <p className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", dark ? "text-blue-200" : "text-slate-400")}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={cn("mt-1 text-2xl font-black", !dark && (tone ?? "text-slate-900"))}>{value}</p>
    </div>
  );
}
