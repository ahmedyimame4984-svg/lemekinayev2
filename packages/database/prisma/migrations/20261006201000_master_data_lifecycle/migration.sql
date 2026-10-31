-- Catalog Core Foundation #17 — Controlled master-data lifecycle.
-- Important canonical masters share one lifecycle:
-- DRAFT -> ACTIVE -> DEPRECATED / SUPERSEDED -> ARCHIVED.
-- INACTIVE is retained only as a legacy compatibility state.

ALTER TYPE "MasterDataStatus" ADD VALUE IF NOT EXISTS 'DEPRECATED';
ALTER TYPE "MasterDataStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

CREATE OR REPLACE FUNCTION "enforce_core_master_data_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" NOT IN ('DRAFT', 'ACTIVE') THEN
      RAISE EXCEPTION
        'Core master data must be created as DRAFT or ACTIVE, not %',
        NEW."status"
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'DRAFT'
     AND NEW."status" IN ('ACTIVE', 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'ACTIVE'
     AND NEW."status" IN ('DEPRECATED', 'SUPERSEDED') THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'DEPRECATED'
     AND NEW."status" IN ('ACTIVE', 'SUPERSEDED', 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'SUPERSEDED'
     AND NEW."status" = 'ARCHIVED' THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'INACTIVE'
     AND NEW."status" IN ('ACTIVE', 'DEPRECATED', 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Invalid core master-data lifecycle transition % -> % on %',
    OLD."status", NEW."status", TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories',
    'product_families',
    'product_types',
    'attribute_definitions',
    'brands',
    'units_of_measure',
    'vehicle_makes',
    'vehicle_models',
    'vehicle_model_derivatives',
    'vehicle_generations',
    'vehicle_trims',
    'vehicle_engines',
    'vehicle_transmissions',
    'vehicle_body_types',
    'vehicle_markets',
    'vehicle_configurations'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS core_master_data_lifecycle_guard ON %I',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER core_master_data_lifecycle_guard
       BEFORE INSERT OR UPDATE OF status ON %I
       FOR EACH ROW
       EXECUTE FUNCTION enforce_core_master_data_lifecycle()',
      table_name
    );
  END LOOP;
END;
$$;
