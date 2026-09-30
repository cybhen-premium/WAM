CREATE TABLE "staff_module" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"module" text NOT NULL,
	CONSTRAINT "staff_module_church_id_church_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."church"("id") ON DELETE cascade,
	CONSTRAINT "staff_module_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_module_uq" ON "staff_module" USING btree ("staff_id","module");--> statement-breakpoint
CREATE INDEX "staff_module_church_idx" ON "staff_module" USING btree ("church_id");--> statement-breakpoint
-- Nobody loses anything on day one: every current staff member is given every module. The superadmin
-- trims them down from Settings → Staff afterwards.
INSERT INTO "staff_module" ("church_id", "staff_id", "module")
SELECT s."church_id", s."id", m."module"
FROM "staff" s
CROSS JOIN (VALUES ('dashboard'),('members'),('akwaaba'),('sob'),('tithes'),('finances'),('analytics'),('events'),('care'),('messaging'),('settings')) AS m("module")
ON CONFLICT DO NOTHING;
