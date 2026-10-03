"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Church, ChevronDown, LogOut, Menu, RotateCcw, X } from "lucide-react";
import { NAV, NAV_ENTRIES, NAV_CATEGORIES } from "@/lib/nav";
import { hasModule, type ModuleKey } from "@/lib/modules";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SessionIdleTimeout } from "./session-idle-timeout";

type Props = {
  churchName: string;
  logoUrl?: string;
  smsCredits: number;
  /** Modules this user may access — the sidebar only shows these (superadmins get all of them). */
  modules: ModuleKey[];
  children: React.ReactNode;
};

export function AppShell({ churchName, logoUrl, smsCredits, modules, children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!confirmLogout) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loggingOut) setConfirmLogout(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmLogout, loggingOut]);

  // Hardware-accurate device and OS detection (resolves mobile phones even in "Desktop site" mode)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const touchPoints = navigator.maxTouchPoints || 0;
      const isTouch = touchPoints > 0 || isCoarse || "ontouchstart" in window;
      const minDim = Math.min(window.screen.width, window.screen.height);
      const maxDim = Math.max(window.screen.width, window.screen.height);

      let realDevice = "Desktop";
      if (isTouch && (minDim < 600 || (minDim < 850 && maxDim < 1000 && isCoarse))) {
        realDevice = "Mobile";
      } else if (isTouch && minDim >= 600 && minDim <= 1024) {
        realDevice = "Tablet";
      }

      const ua = navigator.userAgent || "";
      const isAndroid =
        /android/i.test(ua) ||
        (navigator as any).userAgentData?.platform === "Android" ||
        (/linux/i.test(ua) && isTouch);
      const isIOS =
        /iphone|ipad|ipod/i.test(ua) ||
        (/macintosh/i.test(ua) && touchPoints > 1);

      let realOs = "";
      if (isAndroid) realOs = "Android";
      else if (isIOS) realOs = /ipad/i.test(ua) || (touchPoints > 1 && minDim >= 600) ? "iPadOS" : "iOS";
      else if (/windows/i.test(ua)) realOs = "Windows";
      else if (/macintosh|mac os/i.test(ua)) realOs = "macOS";
      else if (/linux/i.test(ua)) realOs = isTouch ? "Android" : "Linux";

      document.cookie = `wam_device=${realDevice}; path=/; max-age=31536000; SameSite=Lax`;
      if (realOs) {
        document.cookie = `wam_os=${realOs}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // Best effort
    }
  }, []);

  // Track which nav groups are open (by module key); auto-open if current path is inside
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { Analytics: true };
    for (const entry of NAV_ENTRIES) {
      if (
        entry.type === "group" &&
        entry.group.children.some((c) => {
          const basePath = c.href.split("?")[0];
          return pathname === basePath || pathname.startsWith(basePath + "/");
        })
      ) {
        init[entry.group.label] = true;
      }
    }
    return init;
  });

  // Automatically keep group open when navigating to one of its children
  useEffect(() => {
    for (const entry of NAV_ENTRIES) {
      if (
        entry.type === "group" &&
        entry.group.children.some((c) => {
          const basePath = c.href.split("?")[0];
          return pathname === basePath || pathname.startsWith(basePath + "/");
        })
      ) {
        setOpenGroups((prev) => ({ ...prev, [entry.group.label]: true }));
      }
    }
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      const { recordLogoutAction } = await import("@/app/(app)/analytics/actions");
      await recordLogoutAction().catch(() => { });
      await authClient.signOut();
      toast.success("Logged out successfully!");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out. Please try again.");
      setLoggingOut(false);
    }
  }

  // Filter categories and entries by assigned modules for this user
  const visibleCategories = NAV_CATEGORIES.map((cat) => ({
    ...cat,
    entries: cat.entries.filter((e) => {
      const mod = e.type === "item" ? e.item.module : e.group.module;
      return hasModule(modules, mod);
    }),
  })).filter((cat) => cat.entries.length > 0);

  return (
    <div className="flex h-screen overflow-hidden">
      <SessionIdleTimeout />
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0F172A] text-white transition-transform duration-300 lg:static lg:translate-x-0 border-r border-slate-800",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo / Church name */}
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 sidebar-scroll">
          {visibleCategories.map((cat) => (
            <div key={cat.title} className="space-y-1">
              {/* Category Section Header */}
              <div className="px-3 pt-1 pb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {cat.title}
                </span>
              </div>

              {/* Category Entries */}
              {cat.entries.map((entry) => {
                if (entry.type === "item") {
                  const { href, label, icon: Icon } = entry.item;
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-bold transition-all duration-200",
                        active
                          ? "bg-amber-500/10 text-amber-500 border-l-2 border-amber-500 shadow-xs"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                    </Link>
                  );
                }

                const group = entry.group;
                const GroupIcon = group.icon;
                const isGroupOpen = !!openGroups[group.label];
                const groupActive = group.children.some((c) => {
                  const basePath = c.href.split("?")[0];
                  return pathname === basePath || pathname.startsWith(basePath + "/");
                });

                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
                      }
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-bold transition-all duration-200 cursor-pointer",
                        groupActive
                          ? "bg-amber-500/10 text-amber-500 border-l-2 border-amber-500 shadow-xs"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100",
                      )}
                    >
                      <GroupIcon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isGroupOpen ? "rotate-180" : "",
                        )}
                      />
                    </button>

                    {isGroupOpen && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700/60 pl-3">
                        {group.children.map((child) => {
                          const isAnalytics = child.href.startsWith("/analytics");
                          let childActive = false;

                          if (isAnalytics) {
                            const viewParam = searchParams.get("view");
                            if (child.href === "/analytics") {
                              childActive = pathname === "/analytics" && viewParam !== "activity";
                            } else {
                              childActive =
                                (pathname === "/analytics" && viewParam === "activity") ||
                                pathname === "/analytics/activity";
                            }
                          } else {
                            childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                          }

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-200",
                                childActive
                                  ? "text-amber-500 bg-amber-500/10 font-bold"
                                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full transition-all",
                                  childActive
                                    ? "bg-amber-500 opacity-100 scale-125"
                                    : "bg-current opacity-60"
                                )}
                              />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 mt-auto bg-slate-900/60 border-t border-slate-800/60">
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 font-bold text-xs transition-all cursor-pointer group"
          >
            <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>LOGOUT</span>
          </button>
        </div>
      </aside>

      {/* Modern, Premium Logout Confirmation Dialog */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => !loggingOut && setConfirmLogout(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[380px] overflow-hidden rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setConfirmLogout(false)}
              disabled={loggingOut}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer disabled:pointer-events-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Glowing Icon Badge */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 shadow-inner mb-4">
              <LogOut className="h-6 w-6 stroke-[2.2] translate-x-0.5" />
            </div>

            {/* Title & Exact Prompt Message */}
            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Sign Out
              </h3>
              <p className="text-[13px] font-semibold text-slate-600 mt-2 leading-relaxed">
                Are you sure you want to log out of your account?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                disabled={loggingOut}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 py-2.5 px-4 text-xs font-black text-white shadow-md shadow-rose-600/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {loggingOut ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-3.5 w-3.5 stroke-[2.4]" />
                    <span>Yes, log out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
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
