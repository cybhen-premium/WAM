import Link from "next/link";
import { Plug, Settings2, SlidersHorizontal, User } from "lucide-react";
import { requireChurch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getIntegrationForAdmin, isPlatformAdmin } from "@/lib/platform";
import { IntegrationForm } from "./integration-form";
import { BrandingForm, PreferencesForm, ProfileForm, SenderIdForm, SuperAdmin2FAForm, WelcomeToggle } from "./settings-client";
import { requireModule } from "@/lib/permissions";

export const metadata = { title: "Settings & Management" };

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  // Platform admins only (PLATFORM_ADMIN_EMAILS).
  { id: "integrations", label: "Integrations", icon: Plug },
] as const;

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { church, role, user } = await requireChurch();
  await requireModule("settings");
  const sp = await searchParams;
  const platformAdmin = isPlatformAdmin(user.email);
  const tabs = TABS.filter((t) => t.id !== "integrations" || platformAdmin);
  const tab = tabs.find((t) => t.id === sp.tab)?.id ?? "profile";
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6 pb-16 px-2 sm:px-4 md:px-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Settings2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Settings &amp; Management</h1>
          <p className="text-sm text-slate-500">Configure your church platform</p>
        </div>
      </div>

      <nav className={cn("grid w-full gap-1 rounded-2xl bg-slate-100 p-1.5", tabs.length > 3 ? "max-w-2xl grid-cols-4" : "max-w-xl grid-cols-3")}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={id === "profile" ? "/settings" : `/settings?tab=${id}`}
            scroll={false}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl h-10 text-[11px] sm:text-xs font-bold transition-all",
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="h-4 w-4 hidden sm:block" /> {label}
          </Link>
        ))}
      </nav>

      {!isAdmin && tab !== "integrations" && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You can view settings, but only admins can change them.
        </p>
      )}

      {tab === "profile" && (
        <div className="space-y-6">
          <ProfileForm church={church} />
          <BrandingForm church={church} />
          <WelcomeToggle enabled={church.autoWelcomeSms} />
          {isAdmin && <SuperAdmin2FAForm currentMethod={church.ownerTwoFactorMethod ?? "none"} />}
          <SenderIdForm status={church.senderIdStatus} current={church.senderId} requested={church.senderIdRequested} />
        </div>
      )}
      {tab === "preferences" && <PreferencesForm church={church} />}
      {tab === "integrations" && <Integrations />}
    </div>
  );
}


async function Integrations() {
  const [sms, ai] = await Promise.all([
    getIntegrationForAdmin("sms"),
    getIntegrationForAdmin("ai"),
  ]);
  return (
    <div className="space-y-6">
      <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-[#1e3a8a]">
        Platform-wide settings, visible to platform admins only. Keys are encrypted before they&apos;re stored and are never shown again.
      </p>
      <IntegrationForm kind="sms" saved={sms} />
      <IntegrationForm kind="ai" saved={ai} />
    </div>
  );
}
