ALTER TABLE "church" ALTER COLUMN "plan" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "church" ALTER COLUMN "plan" SET DEFAULT 'harvest'::text;--> statement-breakpoint
DROP TYPE "public"."plan";--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('seed', 'growth', 'abundance', 'harvest', 'enterprise');--> statement-breakpoint
ALTER TABLE "church" ALTER COLUMN "plan" SET DEFAULT 'harvest'::"public"."plan";--> statement-breakpoint
ALTER TABLE "church" ALTER COLUMN "plan" SET DATA TYPE "public"."plan" USING "plan"::"public"."plan";