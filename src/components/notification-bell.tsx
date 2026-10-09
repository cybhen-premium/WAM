"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  LogIn,
  Shield,
  Smartphone,
  Monitor,
  Trash2,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  clearNotificationAction,
} from "@/actions/notifications";
import { toast } from "sonner";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load notifications from server
  async function loadData() {
    try {
      const res = await getNotificationsAction();
      if (res.ok) {
        setUnreadCount(res.unreadCount);
        setItems(res.items);
      }
    } catch {
      // Best-effort
    }
  }

  // Initial load and periodic polling every 30 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Mark all as read
  function handleMarkAllRead() {
    startTransition(async () => {
      setUnreadCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      const res = await markAllNotificationsReadAction();
      if (res.ok) {
        toast.success("All notifications marked as read");
      }
    });
  }

  // Mark single item as read
  function handleMarkOneRead(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationReadAction(id);
    });
  }

  // Remove/clear item
  function handleClearOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const target = items.find((i) => i.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (target && !target.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      await clearNotificationAction(id);
    });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex items-center justify-center rounded-xl h-9 w-9 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer",
          open && "bg-slate-100 text-slate-900"
        )}
        aria-label="View notifications"
        title="Admin Notifications"
      >
        <span className="inline-flex origin-top animate-bell-swing pointer-events-none">
          <Bell className="h-4 w-4" />
        </span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] min-[380px]:w-[350px] sm:w-[400px] max-w-[400px] rounded-2xl bg-white shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Notifications
              </span>
              {unreadCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                  {unreadCount} new
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  Caught up
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-1.5 py-0.5 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">No Notifications</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                  When staff members log in or important alerts occur, they will appear here.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const meta = item.metadata || {};
                const isStaffLogin = item.type === "staff_login";
                const device = (meta.device as string) || "Desktop";
                const os = (meta.os as string) || "";
                const browser = (meta.browser as string) || "";

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group relative flex items-start gap-3 p-3.5 transition-colors",
                      !item.read ? "bg-blue-50/40 hover:bg-blue-50/70" : "bg-white hover:bg-slate-50"
                    )}
                  >
                    {/* Icon Badge */}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-xs mt-0.5",
                        isStaffLogin
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                          : "bg-gradient-to-br from-blue-500 to-indigo-600"
                      )}
                    >
                      {isStaffLogin ? (
                        <LogIn className="h-4 w-4" />
                      ) : (
                        <Shield className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </p>
                        {!item.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>

                      <p className="text-[11.5px] font-medium text-slate-600 mt-0.5 leading-snug">
                        {item.message}
                      </p>

                      {/* Meta chips (device, time) */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-semibold">
                        <span className="text-slate-500 font-bold">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                        {Boolean(meta.role) && (
                          <>
                            <span>·</span>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 font-bold">
                              {String(meta.role)}
                            </span>
                          </>
                        )}
                        {Boolean(device) && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              {device === "Mobile" ? (
                                <Smartphone className="h-3 w-3" />
                              ) : (
                                <Monitor className="h-3 w-3" />
                              )}
                              <span>
                                {device} {Boolean(os) ? `(${os})` : ""}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (mark read, clear) */}
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {!item.read && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkOneRead(item.id, e)}
                          title="Mark as read"
                          className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleClearOne(item.id, e)}
                        title="Dismiss notification"
                        className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <Link
              href="/analytics?view=activity"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:underline transition-colors"
            >
              <span>View full activity audit logs</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <span className="text-[10px] text-slate-400 font-medium">Real-time alerts</span>
          </div>
        </div>
      )}
    </div>
  );
}
