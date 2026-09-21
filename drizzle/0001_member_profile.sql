ALTER TABLE "member" ADD COLUMN "full_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "category" text DEFAULT 'General Member' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "baptized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "skills" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "emergency_contact_phone" text;--> statement-breakpoint
UPDATE "member" SET "full_name" = trim("first_name" || ' ' || "last_name");
