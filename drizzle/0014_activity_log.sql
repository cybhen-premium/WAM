CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "church_id" uuid NOT NULL REFERENCES "church"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "actor_name" text NOT NULL DEFAULT 'Unknown',
  "actor_email" text,
  "module" text NOT NULL,
  "action" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "activity_log_church_idx" ON "activity_log"("church_id");
CREATE INDEX IF NOT EXISTS "activity_log_created_idx" ON "activity_log"("created_at");
