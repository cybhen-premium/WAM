CREATE TABLE IF NOT EXISTS "sob_lesson" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "church_id" uuid NOT NULL REFERENCES "church"("id") ON DELETE CASCADE,
  "lesson_number" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "is_graduation" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sob_lesson_church_idx" ON "sob_lesson" ("church_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sob_lesson_church_num_uq" ON "sob_lesson" ("church_id", "lesson_number");

-- Seed default lessons for existing churches
INSERT INTO "sob_lesson" ("church_id", "lesson_number", "title", "description", "is_graduation")
SELECT c.id, 1, 'Lesson 1 — The Fall of Man & Redemption Plan', 'Understanding salvation, the fall, and God''s redemption plan.', false
FROM "church" c
WHERE NOT EXISTS (SELECT 1 FROM "sob_lesson" WHERE church_id = c.id AND lesson_number = 1);

INSERT INTO "sob_lesson" ("church_id", "lesson_number", "title", "description", "is_graduation")
SELECT c.id, 2, 'Lesson 2 — Water Baptism', 'The significance of identification with Christ in water baptism.', false
FROM "church" c
WHERE NOT EXISTS (SELECT 1 FROM "sob_lesson" WHERE church_id = c.id AND lesson_number = 2);

INSERT INTO "sob_lesson" ("church_id", "lesson_number", "title", "description", "is_graduation")
SELECT c.id, 3, 'Lesson 3 — Holy Spirit Baptism', 'The promise of the Father and receiving the Holy Spirit.', false
FROM "church" c
WHERE NOT EXISTS (SELECT 1 FROM "sob_lesson" WHERE church_id = c.id AND lesson_number = 3);

INSERT INTO "sob_lesson" ("church_id", "lesson_number", "title", "description", "is_graduation")
SELECT c.id, 4, 'Baptised', 'Water baptism ceremony and graduation to full church membership.', true
FROM "church" c
WHERE NOT EXISTS (SELECT 1 FROM "sob_lesson" WHERE church_id = c.id AND lesson_number = 4);
