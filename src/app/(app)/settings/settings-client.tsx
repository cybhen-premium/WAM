"use client";

import { useState, useEffect, useTransition } from "react";
import { LocateFixed, Mail, Palette, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useFormAction } from "@/components/use-form-action";
import { cn } from "@/lib/utils";
import type { schema } from "@/db";
import {
  changeRole,
  inviteStaff,
  removeStaff,
  requestSenderId,
  saveBranding,
  savePreferences,
  saveProfile,
  setAutoWelcome,
  setStaffModules,
  type FormState,
} from "./actions";
import { MODULES, MODULE_KEYS } from "@/lib/modules";

type Church = typeof schema.church.$inferSelect;

const label = "mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400";
const field =
  "h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-100";

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-slate-100">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      <p className="mb-6 text-sm text-slate-500">{subtitle}</p>
      {children}
    </section>
  );
}

function Input({ name, title, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { title: string }) {
  return (
    <label className={cn("block", className)}>
      <span className={label}>{title}</span>
      <input name={name} {...rest} className={field} />
    </label>
  );
}

function Submit({ pending, children, state }: { pending: boolean; children: React.ReactNode; state: FormState }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending} className="h-11 rounded-xl bg-[#1e3a8a] px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-900 disabled:opacity-60">
        {pending ? "Saving…" : children}
      </button>
      {state && <p className={cn("text-sm font-bold", state.error ? "text-red-600" : "text-emerald-600")}>{state.error ?? state.message}</p>}
    </div>
  );
}

/* Profile ------------------------------------------------------------------ */

export function ProfileForm({ church }: { church: Church }) {
  const [state, action, pending] = useFormAction(saveProfile);
  const [lat, setLat] = useState(church.latitude ?? "5.603700");
  const [lng, setLng] = useState(church.longitude ?? "-0.187000");
  const [locating, setLocating] = useState(false);

  const la = Number(lat);
  const lo = Number(lng);
  const valid = Number.isFinite(la) && Number.isFinite(lo);
  const bbox = valid ? `${lo - 0.01},${la - 0.006},${lo + 0.01},${la + 0.006}` : "";

  return (
    <Section title="Church Identity & Location" subtitle="Administrative details and geospatial intelligence.">
      <form action={action} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input title="Church Name *" name="name" required defaultValue={church.name} />
          <Input title="Pastor's Name" name="pastorName" defaultValue={church.pastorName ?? ""} />
          <Input title="Phone Number" name="phone" type="tel" defaultValue={church.phone ?? ""} />
          <Input title="Email Address" name="email" type="email" defaultValue={church.email ?? ""} />
          <Input title="City/Town" name="location" defaultValue={church.location ?? ""} />
          <Input title="Ghana Post GPS Code" name="ghanaPostGps" placeholder="e.g. GA-123-4567" defaultValue={church.ghanaPostGps ?? ""} />
          <label className="block sm:col-span-2">
            <span className={label}>Physical Directions</span>
            <textarea name="directions" rows={2} defaultValue={church.directions ?? ""} className={cn(field, "h-auto py-2")} />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-800">Geographic Location</p>
            <button
              type="button"
              onClick={() => {
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (p) => {
                    setLat(p.coords.latitude.toFixed(6));
                    setLng(p.coords.longitude.toFixed(6));
                    setLocating(false);
                  },
                  () => setLocating(false),
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 h-8 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <LocateFixed className="h-3.5 w-3.5" /> {locating ? "Locating…" : "Use my location"}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input title="Latitude" name="latitude" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
            <Input title="Longitude" name="longitude" value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
          </div>
          {valid && (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Coordinates Captured · {la.toFixed(6)}, {lo.toFixed(6)}
              </p>
              <iframe
                title="Church location map"
                className="h-64 w-full rounded-xl border border-slate-100"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${la},${lo}`}
              />
            </>
          )}
        </div>

        <Submit pending={pending} state={state}>
          Save Profile &amp; Map
        </Submit>
      </form>
    </Section>
  );
}

export function BrandingForm({ church }: { church: Church }) {
  const [state, action, pending] = useFormAction(saveBranding);
  const [logo, setLogo] = useState(church.logoUrl ?? "");

  useEffect(() => {
    setLogo(church.logoUrl ?? "");
  }, [church.logoUrl]);

  return (
    <Section title="Custom Branding & Receipts" subtitle="Personalize your platform experience and official documentation.">
      <form action={action} className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided logo URL */}
            {logo ? <img src={logo} alt="Church logo" className="h-full w-full object-contain" /> : <Palette className="h-6 w-6 text-slate-300" />}
          </div>
          <div className="flex-1 space-y-3">
            <Input
              title="Official Organization Logo (image URL or upload)"
              name="logoUrl"
              type="text"
              placeholder="https://…/logo.png"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
            />
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
              Upload Image File
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setLogo(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Primary Brand Color</span>
            <input type="color" name="brandPrimary" defaultValue={church.brandPrimary} className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 p-1" />
          </label>
          <label className="block">
            <span className={label}>Secondary Brand Color</span>
            <input type="color" name="brandSecondary" defaultValue={church.brandSecondary} className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 p-1" />
          </label>
          <label className="block">
            <span className={label}>Receipt Design Template</span>
            <select name="receiptTemplate" defaultValue={church.receiptTemplate} className={field}>
              <option value="classic">Classic / Traditional</option>
              <option value="modern">Modern Layout</option>
              <option value="minimal">Minimalist Layout</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Typography / Font</span>
            <select name="receiptFont" defaultValue={church.receiptFont} className={field}>
              <option value="Arial">Arial (Standard)</option>
              <option value="Roboto">Roboto (Modern)</option>
              <option value="Times New Roman">Times New Roman (Formal)</option>
              <option value="Inter">Inter (Clean)</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
          <input type="checkbox" name="receiptWatermark" defaultChecked={church.receiptWatermark} className="h-4 w-4 accent-[#1e3a8a]" />
          <span>
            <span className="block text-sm font-bold text-slate-800">Enable Logo Watermark</span>
            <span className="text-xs text-slate-500">Fades your logo into the background of receipts.</span>
          </span>
        </label>
        <Submit pending={pending} state={state}>
          Save Branding
        </Submit>
      </form>
    </Section>
  );
}

export function WelcomeToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  return (
    <Section title="Auto-Welcome SMS" subtitle="Automatically send a welcome message to every new visitor added to the system.">
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
        <span>
          <span className="block text-sm font-bold text-slate-800">Enable Auto-Welcome SMS</span>
          <span className="text-xs text-slate-500">When a new visitor is added, the system sends a welcome SMS. Costs 1 credit per visitor.</span>
        </span>
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            startTransition(() => setAutoWelcome(next));
          }}
          className="peer sr-only"
        />
        <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
      </label>
    </Section>
  );
}

export function SenderIdForm({ status, current, requested }: { status: string; current: string | null; requested: string | null }) {
  const [state, action, pending] = useFormAction(requestSenderId);
  const [value, setValue] = useState(requested ?? "");
  const statusText =
    status === "approved" ? `Active: ${current}` : status === "pending" ? `Pending approval: ${requested}` : status === "rejected" ? "Rejected. Try another name." : "No Custom ID";

  return (
    <Section title="Custom SMS Sender ID" subtitle="White-label your outgoing messages with your organization's name.">
      <form action={action} className="space-y-5">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4">
          <ShieldCheck className={cn("h-5 w-5", status === "approved" ? "text-emerald-500" : "text-slate-400")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</span>
          <span className="ml-auto text-sm font-bold text-slate-800">{statusText}</span>
        </div>
        <label className="block">
          <span className="mb-1.5 flex justify-between">
            <span className={label}>Requested Sender ID</span>
            <span className="text-[10px] font-bold text-slate-400">{value.length}/11</span>
          </span>
          <input name="senderId" maxLength={11} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. GRACECHURCH" className={field} />
          <span className="mt-1 block text-xs text-slate-400">11 characters max. Telcos may ask for a signed authorization letter.</span>
        </label>
        <Submit pending={pending} state={state}>
          Submit for Approval
        </Submit>
      </form>
    </Section>
  );
}

/* Preferences -------------------------------------------------------------- */

export function PreferencesForm({ church }: { church: Church }) {
  const [state, action, pending] = useFormAction(savePreferences);
  const [footer, setFooter] = useState(church.appendFooter);

  return (
    <form action={action} className="space-y-6">
      <Section title="Caller ID (Sender Name)" subtitle="The name that appears on your members' phones when they receive an SMS.">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {church.senderIdStatus === "approved" ? "Custom ID" : "Default ID"}
          </p>
          <p className="text-lg font-black text-slate-900">{church.senderIdStatus === "approved" && church.senderId ? church.senderId : "CHURCH_APP"}</p>
          {church.senderIdStatus !== "approved" && (
            <p className="mt-1 text-xs text-slate-500">
              You are using the default network ID. Request a custom Sender ID on the Profile tab.
            </p>
          )}
        </div>
      </Section>

      <Section title="Professional SMS Signature" subtitle="Automatically append your church's name and contact details to outgoing broadcasts.">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
          <span>
            <span className="block text-sm font-bold text-slate-800">Append Footer to Broadcasts</span>
            <span className="text-xs text-slate-500">Turn this off if you prefer to write your own signatures manually.</span>
          </span>
          <input type="checkbox" name="appendFooter" checked={footer} onChange={(e) => setFooter(e.target.checked)} className="peer sr-only" />
          <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        </label>
        <div className={cn("mt-4 rounded-2xl border border-dashed border-slate-200 p-4 font-mono text-xs text-slate-600", !footer && "opacity-40")}>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Live Footer Preview</p>
          &quot;Your custom message goes here...&quot;
          <br />
          ---
          <br />
          {church.name}
          {church.phone ? ` | Tel: ${church.phone}` : ""}
        </div>
        <p className="mt-2 text-xs text-slate-400">* Details are pulled automatically from your Church Profile tab.</p>
      </Section>

      <Section title="Pastoral AI Preferences" subtitle="Configure how the AI assists with member retention and communication.">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={label}>Absence Alert Threshold (weeks)</span>
            <input type="number" name="absenceThresholdWeeks" min={1} max={12} defaultValue={church.absenceThresholdWeeks} className={field} />
            <span className="mt-1 block text-xs text-slate-400">Flags members as &lsquo;At-Risk&rsquo; after this many weeks of no attendance.</span>
          </label>
          <label className="block">
            <span className={label}>AI Language</span>
            <select name="aiLanguage" defaultValue={church.aiLanguage} className={field}>
              {["English", "Twi", "Ga", "Ewe", "French"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>AI Voice &amp; Tone</span>
            <select name="aiTone" defaultValue={church.aiTone} className={field}>
              {["Warm & Pastoral", "Formal", "Joyful & Energetic", "Concise"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Submit pending={pending} state={state}>
        Save All Preferences
      </Submit>
    </form>
  );
}

/* Staff -------------------------------------------------------------------- */

const ROLES = ["admin", "pastor", "finance", "secretary", "usher"];

type ActiveStaff = {
  id: string;
  name: string;
  email: string;
  role: string;
  joined: string;
  self: boolean;
  /** Modules assigned to this person (admins ignore these and keep everything). */
  modules: string[];
};
type PendingStaff = { id: string; email: string; role: string; invited: string; modules: string[] };

/** One toggle per module — the superadmin ticks exactly what this person may open. */
function ModuleToggles({ staff, disabled }: { staff: { id: string; modules: string[] }; disabled: boolean }) {
  const [busy, startTransition] = useTransition();
  const assigned = new Set(staff.modules);

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {MODULE_KEYS.map((key) => {
        const on = assigned.has(key);
        return (
          <button
            key={key}
            type="button"
            disabled={disabled || busy}
            title={`${MODULES[key].label} — ${on ? "allowed" : "blocked"}`}
            aria-pressed={on}
            onClick={() => {
              const next = on ? assigned : new Set([...assigned, key]);
              startTransition(() => setStaffModules(staff.id, [...next]));
            }}
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-tight transition-colors disabled:opacity-50",
              on
                ? "bg-[#1e3a8a] text-white hover:bg-blue-900"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200",
            )}
          >
            {MODULES[key].label}
          </button>
        );
      })}
    </div>
  );
}

export function StaffPanel({ isAdmin, active, pending }: { isAdmin: boolean; active: ActiveStaff[]; pending: PendingStaff[] }) {
  const [state, action, submitting] = useFormAction(inviteStaff);
  const [busy, startTransition] = useTransition();
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      <Section title="Active Staff" subtitle="Users with access to your church account">
        {isAdmin && (
          <form action={action} className="mb-6 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-end">
            <Input className="flex-1" title="Email" name="email" type="email" required placeholder="colleague@church.org" />
            <label className="block sm:w-40">
              <span className={label}>Role</span>
              <select name="role" defaultValue="secretary" className={cn(field, "bg-white capitalize")}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-5 text-xs font-black uppercase text-white hover:bg-blue-900">
              <UserPlus className="h-4 w-4" /> Invite Staff
            </button>
          </form>
        )}
        {state && <p className={cn("-mt-3 mb-4 text-sm font-bold", state.error ? "text-red-600" : "text-emerald-600")}>{state.error ?? state.message}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="py-2">Name / Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Joined</th>
                <th className="py-2 text-right">Modules they can open</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-3">
                    <p className="font-bold text-slate-900">
                      {s.name} {s.self && <span className="text-xs font-semibold text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                  </td>
                  <td className="py-3">
                    {isAdmin && !s.self ? (
                      <select
                        defaultValue={s.role}
                        disabled={busy}
                        onChange={(e) => startTransition(() => changeRole(s.id, e.target.value))}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold capitalize"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-[#1e3a8a]">{s.role}</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-500">{date(s.joined)}</td>
                  <td className="py-3">
                    {s.role === "admin" ? (
                      <p className="text-right text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        Full access
                      </p>
                    ) : (
                      <ModuleToggles staff={s} disabled={!isAdmin || s.self} />
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {isAdmin && !s.self && (
                      <button onClick={() => startTransition(() => removeStaff(s.id))} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${s.email}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Pending Invitations" subtitle="Invitations waiting for acceptance">
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No pending invitations</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.email}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {p.role} · invited {date(p.invited)}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => startTransition(() => removeStaff(p.id))} className="text-xs font-bold text-red-600 hover:underline">
                      Revoke
                    </button>
                  )}
                </div>
                {/* Access can be set before they accept — it applies the moment they sign up. */}
                {p.role !== "admin" && <ModuleToggles staff={p} disabled={!isAdmin} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

