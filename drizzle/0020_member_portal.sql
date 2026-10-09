ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "member_id_code" text UNIQUE;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "portal_active" boolean DEFAULT false NOT NULL;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;

CREATE TABLE IF NOT EXISTS "member_otp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid NOT NULL REFERENCES "member"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "purpose" text DEFAULT 'activation' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_otp_member_idx" ON "member_otp" ("member_id");

CREATE TABLE IF NOT EXISTS "member_session" (
  "id" text PRIMARY KEY NOT NULL,
  "member_id" uuid NOT NULL REFERENCES "member"("id") ON DELETE cascade,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_session_member_idx" ON "member_session" ("member_id");

CREATE TABLE IF NOT EXISTS "member_inquiry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "church_id" uuid NOT NULL REFERENCES "church"("id") ON DELETE cascade,
  "member_id" uuid NOT NULL REFERENCES "member"("id") ON DELETE cascade,
  "subject" text NOT NULL,
  "category" text DEFAULT 'General Inquiry' NOT NULL,
  "message" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reply" text,
  "replied_by" text,
  "replied_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_inquiry_church_idx" ON "member_inquiry" ("church_id");
CREATE INDEX IF NOT EXISTS "member_inquiry_member_idx" ON "member_inquiry" ("member_id");
CREATE INDEX IF NOT EXISTS "member_inquiry_status_idx" ON "member_inquiry" ("status");

CREATE TABLE IF NOT EXISTS "member_notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid NOT NULL REFERENCES "member"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text DEFAULT 'general' NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "link" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_notif_member_idx" ON "member_notification" ("member_id");
CREATE INDEX IF NOT EXISTS "member_notif_created_idx" ON "member_notification" ("created_at");
CREATE INDEX IF NOT EXISTS "member_notif_read_idx" ON "member_notification" ("read");
