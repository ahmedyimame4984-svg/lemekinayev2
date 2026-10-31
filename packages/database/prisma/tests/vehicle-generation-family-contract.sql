-- Run in a staging DB AFTER the additive family migration, before linking
-- reviewed generations. Performs no DML and verifies the fail-closed contract.
DO $$
BEGIN
  IF to_regclass('public.vehicle_generation_families') IS NULL THEN
    RAISE EXCEPTION 'Shared vehicle generation family master is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_generations'
      AND column_name = 'family_id'
      AND udt_name = 'uuid'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Vehicle Generation family FK must be nullable';
  END IF;

  IF EXISTS (SELECT 1 FROM vehicle_generations WHERE family_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Existing generations were linked without reviewed mapping';
  END IF;

  IF EXISTS (SELECT 1 FROM vehicle_generation_families) THEN
    RAISE EXCEPTION 'Generation families were populated without reviewed approval';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_generations_family_id_model_id_fkey'
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE
        'FOREIGN KEY (family_id, model_id) REFERENCES vehicle_generation_families(id, model_id)%'
  ) THEN
    RAISE EXCEPTION 'Cross-model family links must be rejected by composite FK';
  END IF;

  IF (
    SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.vehicle_generation_families'::regclass
      AND contype = 'c'
      AND conname IN (
        'vehicle_generation_families_year_order_chk',
        'vehicle_generation_families_end_status_year_chk'
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'Generation Family production-year constraints are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_generation_families'
      AND column_name = 'end_status'
      AND column_default LIKE '%UNKNOWN%'
  ) THEN
    RAISE EXCEPTION 'Family end status must default UNKNOWN, never CURRENT';
  END IF;
END $$;
