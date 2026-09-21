ALTER TABLE "member" ALTER COLUMN "full_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "last_name";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "department";