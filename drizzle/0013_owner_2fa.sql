ALTER TABLE "church" ADD COLUMN IF NOT EXISTS "owner_two_factor_method" text NOT NULL DEFAULT 'none';
