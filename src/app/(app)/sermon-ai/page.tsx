import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireChurch } from "@/lib/session";
import { aiConfigured } from "@/lib/ai";
import { SermonStudio } from "./studio";

export const metadata = { title: "Sermon AI" };

export default async function SermonAiPage() {
  const { church } = await requireChurch();
  const drafts = await db
    .select()
    .from(schema.sermon)
    .where(eq(schema.sermon.churchId, church.id))
    .orderBy(desc(schema.sermon.createdAt))
    .limit(100);

  return (
    <SermonStudio
      credits={church.smsCredits}
      aiReady={await aiConfigured()}
      drafts={drafts.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        topic: d.topic ?? "",
        scripture: d.scripture ?? "",
        content: d.content,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
