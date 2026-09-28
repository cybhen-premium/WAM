"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Church, Menu, RotateCcw, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Modal, buttonStyles } from "@/components/ui";

type Props = {
  churchName: string;
  logoUrl?: string;
  smsCredits: number;
  children: React.ReactNode;
};

export function AppShell({ churchName, logoUrl, smsCredits, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  async function logout() {
    await authClient.signOut();
    toast.success("Logged out successfully!");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0F172A] text-white transition-transform duration-300 lg:static lg:translate-x-0 border-r border-slate-800",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-3 px-5 border-b border-slate-800/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shrink-0 overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={churchName} className="h-full w-full object-contain" />
            ) : (
              <Church className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[11px] font-black text-white truncate leading-none uppercase tracking-tight">
              {churchName}
            </span>
            <span className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest mt-1">
              Platform Active
            </span>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-bold transition-all duration-200",
                  active
                    ? "bg-amber-500/10 text-amber-500 border-l-2 border-amber-500"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto bg-slate-900/50 border-t border-slate-800/50 space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setConfirmLogout(true)}
              className="inline-flex items-center justify-center rounded-md px-3 text-slate-400 hover:text-white hover:bg-slate-800 font-black text-[10px] h-8 transition-all"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </aside>

      <Modal compact open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Sign out">
        <p className="text-[13px] font-semibold text-slate-600 mb-5 text-center">
          Are you sure you want to log out of your account?
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setConfirmLogout(false)} className={cn(buttonStyles.outline, "w-full sm:w-auto")}>
            Cancel
          </button>
          <button
            onClick={logout}
            className="inline-flex w-full sm:w-auto items-center justify-center whitespace-nowrap transition-all duration-200 active:scale-[0.98] px-6 h-10 md:h-9 text-xs md:text-[11px] font-black rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-md"
          >
            Yes, log out
          </button>
        </div>
      </Modal>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-600" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-[11px] font-black uppercase tracking-tight text-slate-900">{churchName}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          <button
            onClick={() => router.refresh()}
            className="inline-flex items-center justify-center rounded-md h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-accent/10"
            aria-label="Refresh"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
