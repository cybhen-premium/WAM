import "dotenv/config";
import { db, schema } from "../src/db";
import { and, eq } from "drizzle-orm";
import { getSundayDate } from "../src/lib/weeks";
import { TITHE } from "../src/lib/constants";

async function syncTitheDates() {
  console.log("=== Checking Tithe Transactions for Date Synchronization ===");

  const titheTransactions = await db
    .select({
      id: schema.transaction.id,
      description: schema.transaction.description,
      occurredOn: schema.transaction.occurredOn,
      amount: schema.transaction.amount,
    })
    .from(schema.transaction)
    .where(
      and(
        eq(schema.transaction.type, "income"),
        eq(schema.transaction.category, TITHE),
      ),
    );

  console.log(`Found ${titheTransactions.length} tithe transaction(s) in database.`);

  let updatedCount = 0;
  for (const t of titheTransactions) {
    if (!t.description) continue;

    // Pattern: "Week 2, 2026-09"
    const match = t.description.match(/^Week\s+(\d+),\s+(\d{4}-\d{2})$/);
    if (!match) continue;

    const week = parseInt(match[1], 10);
    const month = match[2];
    const correctDate = getSundayDate(month, week);

    if (t.occurredOn !== correctDate) {
      console.log(
        `Syncing transaction ${t.id} (${t.description}): current occurredOn="${t.occurredOn}" -> new occurredOn="${correctDate}"`,
      );
      await db
        .update(schema.transaction)
        .set({ occurredOn: correctDate })
        .where(eq(schema.transaction.id, t.id));
      updatedCount++;
    }
  }

  console.log(`=== Done: Updated ${updatedCount} tithe transaction(s) to match their paid month/Sunday. ===`);
}

syncTitheDates().catch((err) => {
  console.error("Sync error:", err.message || err);
  process.exit(1);
});
