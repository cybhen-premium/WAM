import "server-only";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";

type LogOptions = {
  module: string;
  actionCode?: string;
  action: string;
  actorName?: string;
  actorEmail?: string;
  churchId?: string;
  userId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
};

function deriveActionCode(module: string, action: string): string {
  const lower = action.toLowerCase();
  let verb = "action";
  if (lower.startsWith("added") || lower.startsWith("created")) verb = "create";
  else if (lower.startsWith("updated") || lower.startsWith("changed") || lower.startsWith("set")) verb = "update";
  else if (lower.startsWith("deleted") || lower.startsWith("removed")) verb = "delete";
  else if (lower.startsWith("suspended")) verb = "suspend";
  else if (lower.startsWith("unsuspended") || lower.startsWith("restored")) verb = "unsuspend";
  else if (lower.startsWith("activated")) verb = "activate";
  else if (lower.startsWith("deactivated")) verb = "deactivate";
  else if (lower.startsWith("checked in") || lower.startsWith("recorded")) verb = "record";
  else if (lower.startsWith("logged in")) verb = "login";
  else if (lower.startsWith("logged out")) verb = "logout";
  else if (lower.startsWith("imported")) verb = "import";
  else if (lower.startsWith("sent")) verb = "send";
  return `${module}.${verb}`;
}

export type ClientInfo = {
  device: "Mobile" | "Tablet" | "Desktop";
  os: "iOS" | "Android" | "Windows" | "macOS" | "Linux" | "Other";
  browser: "Chrome" | "Safari" | "Edge" | "Firefox" | "Samsung Internet" | "Opera" | "Other";
  userAgent: string;
};

export function parseClientInfo(
  headerList?: { get(name: string): string | null } | null,
  uaString?: string | null
): ClientInfo {
  const ua = uaString || headerList?.get("user-agent") || "";
  const secMobile = headerList?.get("sec-ch-ua-mobile");
  const secPlatform = headerList?.get("sec-ch-ua-platform")?.replace(/"/g, "");

  // 1. Device detection
  let device: "Mobile" | "Tablet" | "Desktop" = "Desktop";
  const isTablet =
    /ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(ua);
  const isMobile =
    /mobi|iphone|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo/i.test(ua) ||
    (/android/i.test(ua) && /mobile/i.test(ua));

  if (isTablet) {
    device = "Tablet";
  } else if (isMobile || secMobile === "?1") {
    device = "Mobile";
  } else if (secMobile === "?0") {
    device = "Desktop";
  }

  // 2. OS detection
  let os: "iOS" | "Android" | "Windows" | "macOS" | "Linux" | "Other" = "Other";
  if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/android/i.test(ua) || secPlatform?.toLowerCase() === "android") {
    os = "Android";
  } else if (/windows nt|win32|win64/i.test(ua) || secPlatform?.toLowerCase() === "windows") {
    os = "Windows";
  } else if (/macintosh|mac os x/i.test(ua) || secPlatform?.toLowerCase() === "macos") {
    os = "macOS";
  } else if (/linux/i.test(ua) || secPlatform?.toLowerCase() === "linux") {
    os = "Linux";
  }

  // 3. Browser detection
  let browser: "Chrome" | "Safari" | "Edge" | "Firefox" | "Samsung Internet" | "Opera" | "Other" = "Other";
  if (/edg|edge/i.test(ua)) {
    browser = "Edge";
  } else if (/samsungbrowser/i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/opr\/|opera/i.test(ua)) {
    browser = "Opera";
  } else if (/chrome|crios|crmo/i.test(ua)) {
    browser = "Chrome";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
    browser = "Safari";
  }

  return {
    device,
    os,
    browser,
    userAgent: ua,
  };
}

/**
 * Fire-and-forget activity logger. Call from any server action after a
 * meaningful mutation or interaction. Silently swallows errors so a log failure never
 * breaks the main action.
 */
export async function logActivity(opts: LogOptions): Promise<void> {
  try {
    let churchId = opts.churchId;
    let userId = opts.userId;
    let actorName = opts.actorName;
    let actorEmail = opts.actorEmail;
    let ipAddress: string | null | undefined = opts.ipAddress;
    let userAgent: string | null = null;
    let clientInfo: ClientInfo = { device: "Desktop", os: "Other", browser: "Other", userAgent: "" };

    if (!churchId || !userId || !actorName) {
      try {
        const session = await requireChurch();
        churchId = churchId ?? session.church.id;
        userId = userId ?? session.user.id;
        actorName = actorName ?? (session.user.name || session.user.email);
        actorEmail = actorEmail ?? session.user.email;
      } catch {
        // Not in an authenticated church session
      }
    }

    if (!churchId) return;

    try {
      const h = await headers();
      if (!ipAddress) {
        ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      }
      userAgent = h.get("user-agent") || null;
      clientInfo = parseClientInfo(h, userAgent);
    } catch {
      // headers() might not be available outside request context
    }

    const actionCode = opts.actionCode || deriveActionCode(opts.module, opts.action);

    const metadata: Record<string, unknown> = {
      ...(opts.metadata ?? {}),
      device: (opts.metadata as Record<string, unknown>)?.device || clientInfo.device,
      os: (opts.metadata as Record<string, unknown>)?.os || clientInfo.os,
      browser: (opts.metadata as Record<string, unknown>)?.browser || clientInfo.browser,
      userAgent:
        (opts.metadata as Record<string, unknown>)?.userAgent ||
        (userAgent ? userAgent.slice(0, 300) : undefined),
    };

    await db.insert(schema.activityLog).values({
      churchId,
      userId: userId ?? null,
      actorName: actorName || "Unknown",
      actorEmail: actorEmail ?? null,
      module: opts.module,
      actionCode,
      action: opts.action,
      ipAddress: ipAddress ?? null,
      metadata,
    });
  } catch {
    // Never throw — logging is best-effort
  }
}

