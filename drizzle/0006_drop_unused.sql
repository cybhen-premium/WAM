ALTER TABLE "announcement" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "visitor" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "welfare_case" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "announcement" CASCADE;--> statement-breakpoint
DROP TABLE "visitor" CASCADE;--> statement-breakpoint
DROP TABLE "welfare_case" CASCADE;--> statement-breakpoint
ALTER TABLE "follow_up" ALTER COLUMN "member_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_up" DROP COLUMN "visitor_id";--> statement-breakpoint
ALTER TABLE "follow_up" DROP COLUMN "reason";--> statement-breakpoint
ALTER TABLE "follow_up" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "follow_up" DROP COLUMN "due_on";--> statement-breakpoint
DROP TYPE "public"."follow_up_status";