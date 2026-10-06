ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "akwaaba_status" text;--> statement-breakpoint
UPDATE "member" SET "akwaaba_status" = CASE WHEN "category" = 'Visitor' THEN 'visiting' ELSE 'staying' END WHERE "from_akwaaba" = true AND "akwaaba_status" IS NULL;
