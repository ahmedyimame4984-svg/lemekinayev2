-- Disposable CI fixtures only. These model a legacy but schema-valid RHD identity
-- so the additive reconstruction migration can prove it preserves existing records.
INSERT INTO users (id, email, account_type, updated_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'migration-test@example.invalid', 'ADMIN', now());

INSERT INTO vehicle_makes (id, code, name, status, created_by_id, updated_by_id, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111', 'TEST_MAKE', 'Synthetic Make', 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_models (id, make_id, code, name, status, created_by_id, updated_by_id, updated_at)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'TEST_MODEL', 'Synthetic Model', 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_generations (id, model_id, code, name, start_year, end_status, status, created_by_id, updated_by_id, updated_at)
VALUES ('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', 'TEST_GEN', 'Synthetic Generation', 2020, 'UNKNOWN', 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_trims (id, generation_id, code, name, start_year, status, created_by_id, updated_by_id, updated_at)
VALUES ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666', 'TEST_TRIM', 'Synthetic Trim', 2020, 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_engines (id, code, name, start_year, status, created_by_id, updated_by_id, updated_at)
VALUES ('88888888-8888-4888-8888-888888888888', 'TEST_ENG', 'Synthetic Engine', 2020, 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_transmissions (id, code, transmission_type, drive_type, start_year, status, created_by_id, updated_by_id, updated_at)
VALUES ('99999999-9999-4999-8999-999999999999', 'TEST_TX', 'AUTOMATIC', 'FWD', 2020, 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_body_types (id, code, name, status, created_by_id, updated_by_id, updated_at)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'TEST_BODY', 'Synthetic Body', 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_markets (id, code, name, status, created_by_id, updated_by_id, updated_at)
VALUES ('33333333-3333-4333-8333-333333333333', 'SOUTHERN_AFRICA', 'Legacy Southern Africa', 'ACTIVE', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now());

INSERT INTO vehicle_configurations (
  id, identity_code, code, make_id, model_id, generation_id, trim_id,
  engine_id, transmission_id, body_type_id, market_id,
  production_start_year, steering_side, status, version,
  created_by_id, updated_by_id, updated_at
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  'VC-44444444444444448444444444444444',
  'TEST_LEGACY_RHD',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '33333333-3333-4333-8333-333333333333',
  2020,
  'RHD',
  'ACTIVE',
  4,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  now()
);

INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id)
VALUES ('55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'TEST_LEGACY_HISTORY', 'VehicleConfiguration', '44444444-4444-4444-8444-444444444444');
