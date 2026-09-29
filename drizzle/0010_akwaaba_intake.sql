ALTER TABLE "member" ADD COLUMN "from_akwaaba" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill: everyone currently in a reception status, plus anyone ever added to the follow-up
-- pipeline (every Akwaaba registration creates one there automatically).
UPDATE "member" set "from_akwaaba" = true where "category" in ('Visitor', 'Regular Attendee') or exists (select 1 from "follow_up" f where f."member_id" = "member"."id");
