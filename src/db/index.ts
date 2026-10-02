import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Wrap Neon's fetch function with automatic retries on transient connection resets / socket drops
const originalFetch = globalThis.fetch;
if (originalFetch) {
  neonConfig.fetchFunction = async (url: string | URL | Request, options?: RequestInit) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await originalFetch(url, options);
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, attempt * 150));
      }
    }
    return originalFetch(url, options);
  };
}

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
export { schema };
