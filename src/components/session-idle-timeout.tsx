"use client";

import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

// Default inactivity timeout: 15 minutes (or configured via NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES)
const DEFAULT_TIMEOUT_MINUTES = 15;

export function SessionIdleTimeout() {
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    const minutesConfig = process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES;
    const timeoutMinutes = minutesConfig ? Math.max(1, Number(minutesConfig)) : DEFAULT_TIMEOUT_MINUTES;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const STORAGE_KEY = "wam_last_active_timestamp";

    // Initialize timestamp if missing
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    const performAutoLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        const { recordLogoutAction } = await import("@/app/(app)/analytics/actions");
        await recordLogoutAction().catch(() => {});
      } catch {
        // Best effort
      }

      try {
        await authClient.signOut();
      } catch {
        // Best effort
      }

      localStorage.removeItem(STORAGE_KEY);

      // Preserve current path for seamless resume after signing back in
      const currentPath = window.location.pathname + window.location.search;
      const nextParam =
        currentPath && currentPath !== "/login" ? `&next=${encodeURIComponent(currentPath)}` : "";

      window.location.href = `/login?reason=expired${nextParam}`;
    };

    // Throttled activity updater (records at most once every 3 seconds)
    let lastThrottledTime = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottledTime > 3000) {
        lastThrottledTime = now;
        localStorage.setItem(STORAGE_KEY, now.toString());
      }
    };

    // User interactions indicating active engagement
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
      "click",
      "focus",
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Check periodically for idle expiration
    const checkInterval = setInterval(() => {
      const lastActiveStr = localStorage.getItem(STORAGE_KEY);
      const lastActive = lastActiveStr ? Number(lastActiveStr) : Date.now();
      const idleElapsed = Date.now() - lastActive;

      if (idleElapsed >= timeoutMs) {
        performAutoLogout();
      }
    }, 5000);

    // Immediately check if tab becomes visible after being backgrounded or computer waking up
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const lastActiveStr = localStorage.getItem(STORAGE_KEY);
        const lastActive = lastActiveStr ? Number(lastActiveStr) : Date.now();
        if (Date.now() - lastActive >= timeoutMs) {
          performAutoLogout();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Sync activity across multiple open tabs in the same browser
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        lastThrottledTime = Number(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
      clearInterval(checkInterval);
    };
  }, []);

  return null;
}
