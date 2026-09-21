import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Daily birthday & anniversary SMS at 08:00 Ghana time (UTC+0).
  crons: [{ path: "/api/cron/celebrations", schedule: "0 8 * * *" }],
};
