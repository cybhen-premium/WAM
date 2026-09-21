CREATE TYPE "public"."follow_up_stage" AS ENUM('new', 'contacted', 'visited', 'integrated');--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "follow_up" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "ghana_post_gps" text;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "directions" text;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "brand_primary" text DEFAULT '#1e3a8a' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "brand_secondary" text DEFAULT '#f59e0b' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "receipt_template" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "receipt_font" text DEFAULT 'Arial' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "receipt_watermark" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "sender_id" text;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "sender_id_requested" text;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "sender_id_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "append_footer" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "auto_welcome_sms" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "automation_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "birthday_template" text DEFAULT 'Happy birthday [Name]! The whole church family celebrates you today. God bless you.' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "anniversary_template" text DEFAULT 'Happy wedding anniversary [Name]! May God continue to bless your home.' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "absence_threshold_weeks" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "ai_language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "ai_tone" text DEFAULT 'Warm & Pastoral' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "billing_cycle" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "renews_at" date;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "church" ADD COLUMN "referred_by" text;--> statement-breakpoint
ALTER TABLE "follow_up" ADD COLUMN "kind" text DEFAULT 'convert' NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_up" ADD COLUMN "stage" "follow_up_stage" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_up" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "follow_up" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "converted_at" date;--> statement-breakpoint
ALTER TABLE "message_log" ADD COLUMN "kind" text DEFAULT 'broadcast' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_log" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "message_log" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "message_log" ADD COLUMN "status" text DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "sermon" ADD COLUMN "kind" text DEFAULT 'sermon' NOT NULL;--> statement-breakpoint
ALTER TABLE "sermon" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "sermon" ADD COLUMN "preach_on" date;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_church_id_church_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."church"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church" ADD CONSTRAINT "church_referral_code_unique" UNIQUE("referral_code");