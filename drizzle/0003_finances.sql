CREATE TABLE "project_fund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target" numeric(12, 2) NOT NULL,
	"due_on" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" text NOT NULL,
	"service" text,
	"contact_name" text,
	"phone" text,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "receipt_no" integer;--> statement-breakpoint
ALTER TABLE "project_fund" ADD CONSTRAINT "project_fund_church_id_church_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."church"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_church_id_church_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."church"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_project_id_project_fund_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_fund"("id") ON DELETE set null ON UPDATE no action;