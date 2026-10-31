DO $$
BEGIN
  -- Existing identity and audit history must survive unchanged.
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_configurations
    WHERE id = '44444444-4444-4444-8444-444444444444'
      AND identity_code = 'VC-44444444444444448444444444444444'
      AND code = 'TEST_LEGACY_RHD' AND steering_side = 'RHD'
      AND status = 'ACTIVE' AND version = 4
      AND market_id = '33333333-3333-4333-8333-333333333333'
      AND drive_type IS NULL AND material_market_variant IS NULL
  ) THEN
    RAISE EXCEPTION 'Reconstruction migration/audit changed an existing identity';
  END IF;

  IF (SELECT count(*) FROM vehicle_configuration_market_applicability) <> 0 THEN
    RAISE EXCEPTION 'Legacy market roles were guessed/backfilled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vehicle_markets
    WHERE id = '33333333-3333-4333-8333-333333333333'
      AND kind IS NULL
      AND country_code IS NULL
      AND region_code IS NULL
      AND specification_reference IS NULL
  ) THEN
    RAISE EXCEPTION 'Legacy market classification changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM audit_logs
    WHERE id = '55555555-5555-4555-8555-555555555555'
      AND action = 'TEST_LEGACY_HISTORY'
  ) THEN
    RAISE EXCEPTION 'Audit history was lost';
  END IF;

  -- Focused schema contract for this reconstruction migration.
  IF to_regclass('public.vehicle_configuration_market_applicability') IS NULL THEN
    RAISE EXCEPTION 'Market applicability table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_markets'
      AND column_name = 'kind'
      AND udt_name = 'VehicleMarketKind'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'vehicle_markets.kind does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_markets'
      AND column_name = 'country_code'
      AND data_type = 'character'
      AND character_maximum_length = 2
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'vehicle_markets.country_code does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_configurations'
      AND column_name = 'drive_type'
      AND data_type = 'character varying'
      AND character_maximum_length = 40
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'vehicle_configurations.drive_type does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_configurations'
      AND column_name = 'material_market_variant'
      AND data_type = 'character varying'
      AND character_maximum_length = 80
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'vehicle_configurations.material_market_variant does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_data_provenance'
      AND column_name = 'source_kind'
      AND udt_name = 'MasterDataSourceKind'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'master_data_provenance.source_kind does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_data_provenance'
      AND column_name = 'published_at'
      AND data_type = 'timestamp without time zone'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'master_data_provenance.published_at does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'VehicleMarketApplicabilityRole'
    GROUP BY t.oid
    HAVING array_agg(e.enumlabel::text ORDER BY e.enumsortorder) = ARRAY['TARGET', 'SOURCE']
  ) THEN
    RAISE EXCEPTION 'VehicleMarketApplicabilityRole enum does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'VehicleMarketKind'
    GROUP BY t.oid
    HAVING array_agg(e.enumlabel::text ORDER BY e.enumsortorder) = ARRAY['COUNTRY', 'REGION', 'SPECIFICATION']
  ) THEN
    RAISE EXCEPTION 'VehicleMarketKind enum does not match the reconstruction schema contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'MasterDataSourceKind'
    GROUP BY t.oid
    HAVING array_agg(e.enumlabel::text ORDER BY e.enumsortorder) = ARRAY['OEM', 'OFFICIAL_DISTRIBUTOR', 'HOMOLOGATION', 'SECONDARY']
  ) THEN
    RAISE EXCEPTION 'MasterDataSourceKind enum does not match the reconstruction schema contract';
  END IF;

  IF to_regclass('public.vehicle_market_applicability_identity_key') IS NULL
     OR to_regclass('public.vehicle_market_applicability_market_role_status_idx') IS NULL
     OR to_regclass('public.vehicle_market_applicability_configuration_status_idx') IS NULL THEN
    RAISE EXCEPTION 'Market applicability indexes are incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_market_applicability_configuration_fkey'
      AND contype = 'f'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_market_applicability_market_fkey'
      AND contype = 'f'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_market_applicability_created_by_fkey'
      AND contype = 'f'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_market_applicability_updated_by_fkey'
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'Market applicability foreign-key contract is incomplete';
  END IF;
END $$;
