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

/**
 * Fire-and-forget activity logger. Call from any server action after a
 * meaningful mutation. Silently swallows errors so a log failure never
 * breaks the main action.
 */
export async function logActivity(opts: LogOptions): Promise<void> {
  try {
    let churchId = opts.churchId;
    let userId = opts.userId;
    let actorName = opts.actorName;
    let actorEmail = opts.actorEmail;
    let ipAddress: string | null | undefined = opts.ipAddress;

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

    if (!ipAddress) {
      try {
        const h = await headers();
        ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      } catch {
        // headers() might not be available outside request context
      }
    }

    const actionCode = opts.actionCode || deriveActionCode(opts.module, opts.action);

    await db.insert(schema.activityLog).values({
      churchId,
      userId: userId ?? null,
      actorName: actorName || "Unknown",
      actorEmail: actorEmail ?? null,
      module: opts.module,
      actionCode,
      action: opts.action,
      ipAddress: ipAddress ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // Never throw — logging is best-effort
  }
}

