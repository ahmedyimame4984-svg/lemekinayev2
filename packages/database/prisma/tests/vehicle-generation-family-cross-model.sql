-- Disposable PostgreSQL smoke test; never execute against a real library.
-- Requires the synthetic vehicle-reconstruction-before.sql fixtures.
-- All writes are rolled back; no vehicle or family persists.
--
-- psql -v ON_ERROR_STOP=1 -d lemekinaye_family_test \
--   -f packages/database/prisma/tests/vehicle-generation-family-cross-model.sql
--
-- The database-name guard protects production even if this script is run by mistake.
DO $$
BEGIN
  IF current_database() !~ '(_test|_staging|_ci)$' THEN
    RAISE EXCEPTION 'Refusing family FK test outside disposable test/staging/ci DB';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_generations
    WHERE id = '66666666-6666-4666-8666-666666666666'
      AND model_id = '22222222-2222-4222-8222-222222222222'
      AND family_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Synthetic migration fixture missing: do not run on a real library';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE
  actor_id CONSTANT uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  make_id CONSTANT uuid := '11111111-1111-4111-8111-111111111111';
  original_model_id CONSTANT uuid := '22222222-2222-4222-8222-222222222222';
  unrelated_model_id CONSTANT uuid := '22222222-2222-4222-8222-333333333333';
  generation_id CONSTANT uuid := '66666666-6666-4666-8666-666666666666';
  original_family_id CONSTANT uuid := '456789ab-4567-4567-8567-456789abcdef';
  unrelated_family_id CONSTANT uuid := '556789ab-4567-4567-8567-456789abcdef';
  violated_constraint text;
BEGIN
  INSERT INTO vehicle_models (
    id, make_id, code, name, status, created_by_id, updated_by_id, updated_at
  ) VALUES (
    unrelated_model_id, make_id, 'TEST_UNRELATED_FAMILY_MODEL',
    'Disposable Other Model', 'DRAFT', actor_id, actor_id, now()
  );

  -- A family code is unique per model, not across all models.
  INSERT INTO vehicle_generation_families (
    id, model_id, code, name, status, created_by_id, updated_by_id, updated_at
  ) VALUES
    (original_family_id, original_model_id, 'TEST_FAMILY', 'Original test family',
      'DRAFT', actor_id, actor_id, now()),
    (unrelated_family_id, unrelated_model_id, 'TEST_FAMILY', 'Other model family',
      'DRAFT', actor_id, actor_id, now());

  -- A matching Model -> Family link must work without changing Generation ID.
  UPDATE vehicle_generations
  SET family_id = original_family_id
  WHERE id = generation_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM vehicle_generations
    WHERE id = generation_id AND model_id = original_model_id
      AND family_id = original_family_id
  ) THEN
    RAISE EXCEPTION 'Same-model Generation Family link was not accepted';
  END IF;

  -- The PostgreSQL composite FK must reject assigning the other Model's family.
  BEGIN
    UPDATE vehicle_generations
    SET family_id = unrelated_family_id
    WHERE id = generation_id;
    RAISE EXCEPTION 'Cross-model Generation Family link was wrongly accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'vehicle_generations_family_id_model_id_fkey' THEN
      RAISE EXCEPTION 'Unexpected FK failure: %', violated_constraint;
    END IF;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM vehicle_generations
    WHERE id = generation_id AND family_id = original_family_id
  ) THEN
    RAISE EXCEPTION 'Failed cross-model attempt changed the valid family link';
  END IF;

  -- Production-year rules must be enforced by PostgreSQL, not only APIs.
  BEGIN
    INSERT INTO vehicle_generation_families (
      model_id, code, name, start_year, end_year, end_status,
      created_by_id, updated_by_id, updated_at
    ) VALUES (
      original_model_id, 'TEST_INVALID_RANGE', 'Invalid year order',
      2025, 2020, 'ENDED', actor_id, actor_id, now()
    );
    RAISE EXCEPTION 'Generation Family accepted a reversed year range';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'vehicle_generation_families_year_order_chk' THEN
      RAISE EXCEPTION 'Unexpected year-range constraint: %', violated_constraint;
    END IF;
  END;

  BEGIN
    INSERT INTO vehicle_generation_families (
      model_id, code, name, end_year, created_by_id, updated_by_id, updated_at
    ) VALUES (
      original_model_id, 'TEST_UNKNOWN_ENDED', 'End year without ENDED',
      2024, actor_id, actor_id, now()
    );
    RAISE EXCEPTION 'Generation Family accepted an end year with UNKNOWN status';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'vehicle_generation_families_end_status_year_chk' THEN
      RAISE EXCEPTION 'Unexpected end-status constraint: %', violated_constraint;
    END IF;
  END;

  BEGIN
    INSERT INTO vehicle_generation_families (
      model_id, code, name, end_status, created_by_id, updated_by_id, updated_at
    ) VALUES (
      original_model_id, 'TEST_ENDED_MISSING_YEAR', 'ENDED without end year',
      'ENDED', actor_id, actor_id, now()
    );
    RAISE EXCEPTION 'Generation Family accepted ENDED with no end year';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'vehicle_generation_families_end_status_year_chk' THEN
      RAISE EXCEPTION 'Unexpected ended-without-year constraint: %', violated_constraint;
    END IF;
  END;

  INSERT INTO vehicle_generation_families (
    model_id, code, name, start_year, end_year, end_status,
    created_by_id, updated_by_id, updated_at
  ) VALUES (
    original_model_id, 'TEST_VALID_ENDED', 'Valid ended family',
    2020, 2024, 'ENDED', actor_id, actor_id, now()
  );

  -- New family state must not imply Active or CURRENT.
  IF EXISTS (
    SELECT 1 FROM vehicle_generation_families
    WHERE code = 'TEST_FAMILY'
      AND (status <> 'DRAFT' OR end_status <> 'UNKNOWN')
  ) THEN
    RAISE EXCEPTION 'New family lifecycle defaults were changed';
  END IF;
END $$;

-- This is intentional. The synthetic second model, both families and the
-- temporary Generation link do not survive this test.
ROLLBACK;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM vehicle_generations
    WHERE id = '66666666-6666-4666-8666-666666666666'
      AND family_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM vehicle_generation_families
    WHERE code IN ('TEST_FAMILY', 'TEST_VALID_ENDED')
  ) THEN
    RAISE EXCEPTION 'Family FK smoke test left a persistent change';
  END IF;
END $$;
