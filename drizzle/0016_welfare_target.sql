ALTER TABLE "church" ADD COLUMN IF NOT EXISTS "welfare_monthly_target" numeric(12, 2) NOT NULL DEFAULT '20.00';
