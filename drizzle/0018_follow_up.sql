CREATE TABLE IF NOT EXISTS "follow_up" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL REFERENCES "church"("id") ON DELETE CASCADE,
	"member_id" uuid NOT NULL REFERENCES "member"("id") ON DELETE CASCADE,
	"kind" text DEFAULT 'convert' NOT NULL,
	"stage" "follow_up_stage" DEFAULT 'new' NOT NULL,
	"assigned_to" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
