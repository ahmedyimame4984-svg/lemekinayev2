-- Synthetic Stage 1 preservation fixture for an EMPTY isolated Stage 2 upgrade database only.
-- Never use real records or a working/production database.
BEGIN;
DO $fixture$
DECLARE
  actor uuid := gen_random_uuid();
  make uuid := gen_random_uuid();
  model uuid := gen_random_uuid();
  generation uuid := gen_random_uuid();
  trim uuid := gen_random_uuid();
  engine uuid := gen_random_uuid();
  transmission uuid := gen_random_uuid();
  body uuid := gen_random_uuid();
  market uuid := gen_random_uuid();
  active_vehicle uuid := gen_random_uuid();
  draft_vehicle uuid := gen_random_uuid();
  category uuid := gen_random_uuid();
  product_type uuid := gen_random_uuid();
  schema_version uuid := gen_random_uuid();
  product uuid := gen_random_uuid();
  synthetic_vin constant text := 'ZZZ00000000000001'; -- invented test value, never decoded
BEGIN
  IF current_database() <> 'lemekinaye_ev_stage02_upgrade_utf8' THEN
    RAISE EXCEPTION 'Fixture requires the isolated EV test database';
  END IF;
  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM vehicle_configurations) THEN
    RAISE EXCEPTION 'Fixture requires empty user and vehicle tables';
  END IF;
  INSERT INTO users (id,name,account_type,status,updated_at)
    VALUES (actor,'EVTEST synthetic actor','ADMIN','ACTIVE',now());
  INSERT INTO vehicle_makes (id,code,name,status,created_by_id,updated_by_id,updated_at)
    VALUES (make,'EVTEST-MAKE','EVTEST synthetic make','ACTIVE',actor,actor,now());
  INSERT INTO vehicle_models (id,make_id,code,name,status,created_by_id,updated_by_id,updated_at)
    VALUES (model,make,'EVTEST-MODEL','EVTEST synthetic model','ACTIVE',actor,actor,now());
  INSERT INTO vehicle_generations (id,model_id,name,start_year,status,created_by_id,updated_by_id,updated_at)
    VALUES (generation,model,'EVTEST synthetic generation',2020,'ACTIVE',actor,actor,now());
  INSERT INTO vehicle_trims (id,generation_id,name,start_year,status,created_by_id,updated_by_id,updated_at)
    VALUES (trim,generation,'EVTEST synthetic trim',2020,'ACTIVE',actor,actor,now());
  INSERT INTO vehicle_engines (id,code,name,status,created_by_id,updated_by_id,updated_at)
    VALUES (engine,'EVTEST-ENGINE','EVTEST synthetic engine','ACTIVE',actor,actor,now());
  INSERT INTO vehicle_transmissions (id,code,transmission_type,status,created_by_id,updated_by_id,updated_at)
    VALUES (transmission,'EVTEST-TRANSMISSION','MANUAL','ACTIVE',actor,actor,now());
  INSERT INTO vehicle_body_types (id,code,name,status,created_by_id,updated_by_id,updated_at)
    VALUES (body,'EVTEST-BODY','EVTEST synthetic body','ACTIVE',actor,actor,now());
  INSERT INTO vehicle_markets (id,code,name,status,created_by_id,updated_by_id,updated_at)
    VALUES (market,'EVTEST-MARKET','EVTEST synthetic market','ACTIVE',actor,actor,now());
  INSERT INTO vehicle_configurations (id,identity_code,code,make_id,model_id,generation_id,
    trim_id,engine_id,transmission_id,body_type_id,market_id,drive_type,model_year,
    production_start_year,steering_side,status,version,created_by_id,updated_by_id,updated_at)
    VALUES (active_vehicle,'VC-'||upper(replace(active_vehicle::text,'-','')),'EVTEST-ACTIVE',
      make,model,generation,trim,engine,transmission,body,market,'FWD',2020,2020,'LHD',
      'ACTIVE',3,actor,actor,now()),
      (draft_vehicle,'VC-'||upper(replace(draft_vehicle::text,'-','')),'EVTEST-DRAFT',
      make,model,generation,trim,NULL,NULL,body,market,NULL,2021,2021,'LHD',
      'DRAFT',2,actor,actor,now());
  INSERT INTO categories (id,code,name,slug,level,created_by_id,updated_by_id,updated_at)
    VALUES (category,'EVTEST-CATEGORY','EVTEST synthetic category','evtest-category',1,actor,actor,now());
  INSERT INTO product_types (id,category_id,code,name,slug,created_by_id,updated_by_id,updated_at)
    VALUES (product_type,category,'EVTEST-TYPE','EVTEST synthetic type','evtest-type',actor,actor,now());
  INSERT INTO product_type_schema_versions (id,product_type_id,schema_version,schema_hash,snapshot,published_by_id)
    VALUES (schema_version,product_type,1,repeat('0',64),'[]'::jsonb,actor);
  INSERT INTO products (id,category_id,product_type_id,schema_version_id,name,created_by_id,updated_by_id,updated_at)
    VALUES (product,category,product_type,schema_version,'EVTEST synthetic article',actor,actor,now());
  INSERT INTO product_vehicle_articles (id,product_id,vehicle_configuration_id,updated_at)
    VALUES (gen_random_uuid(),product,active_vehicle,now());
  INSERT INTO vehicle_compatibilities (id,product_id,vehicle_configuration_id,fitment_type,
    source,created_by_id,updated_by_id,updated_at)
    VALUES (gen_random_uuid(),product,active_vehicle,'EXACT','ADMIN',actor,actor,now());
  INSERT INTO vehicle_profiles (id,user_id,vehicle_configuration_id,identification_method,updated_at)
    VALUES (gen_random_uuid(),actor,active_vehicle,'MANUAL',now());
  INSERT INTO vehicle_profiles (id,user_id,vehicle_configuration_id,identification_method,
    identifier_value,identifier_provider,vin,vin_provider,display_name,updated_at)
    VALUES (gen_random_uuid(),actor,active_vehicle,'VIN',synthetic_vin,'EVTEST',
      synthetic_vin,'EVTEST','EVTEST synthetic VIN garage entry',now());
  INSERT INTO vehicle_identifier_mappings (id,identifier_type,raw_identifier,normalized_identifier,
    vehicle_configuration_id,created_by_id,updated_by_id,updated_at)
    VALUES (gen_random_uuid(),'CHASSIS','EVTEST-NOT-A-REAL-CHASSIS','EVTEST-NOT-A-REAL-CHASSIS',
      active_vehicle,actor,actor,now());
  INSERT INTO vehicle_identifier_mappings (id,identifier_type,raw_identifier,normalized_identifier,
    vehicle_configuration_id,provider,source_reference,created_by_id,updated_by_id,updated_at)
    VALUES (gen_random_uuid(),'VIN',synthetic_vin,synthetic_vin,active_vehicle,
      'EVTEST','EVTEST synthetic VIN; not a real vehicle',actor,actor,now());
END
$fixture$;
COMMIT;

DO $ev$
DECLARE actor uuid; vehicle uuid; motor uuid := gen_random_uuid(); drive uuid := gen_random_uuid(); battery uuid := gen_random_uuid(); charger uuid := gen_random_uuid();
BEGIN
  SELECT id INTO STRICT actor FROM users WHERE name='EVTEST synthetic actor';
  SELECT id INTO STRICT vehicle FROM vehicle_configurations WHERE code='EVTEST-DRAFT';
  INSERT INTO vehicle_electric_motors (id,name,created_by_id,updated_by_id,updated_at) VALUES (motor,'EVTEST existing motor',actor,actor,now());
  INSERT INTO vehicle_drive_units (id,name,created_by_id,updated_by_id,updated_at) VALUES (drive,'EVTEST existing assembly',actor,actor,now());
  INSERT INTO vehicle_battery_packs (id,name,created_by_id,updated_by_id,updated_at) VALUES (battery,'EVTEST existing store',actor,actor,now());
  INSERT INTO vehicle_charging_systems (id,name,ac_connector,created_by_id,updated_by_id,updated_at) VALUES (charger,'EVTEST AC-only','TYPE_2',actor,actor,now());
  INSERT INTO vehicle_configuration_electric_motors (id,configuration_id,electric_motor_id) VALUES(gen_random_uuid(),vehicle,motor);
  INSERT INTO vehicle_configuration_drive_units (id,configuration_id,drive_unit_id) VALUES(gen_random_uuid(),vehicle,drive);
  UPDATE vehicle_configurations SET powertrain_type='BEV',battery_pack_id=battery,charging_system_id=charger WHERE id=vehicle;
END
$ev$;
CREATE SCHEMA ev_stage02_assert;
CREATE TABLE ev_stage02_assert.digests (name text PRIMARY KEY, row_count bigint NOT NULL, digest text NOT NULL);
DO $snapshot$
DECLARE name text; count_value bigint; digest_value text;
BEGIN
  FOREACH name IN ARRAY ARRAY['vehicle_configurations','vehicle_compatibilities','vehicle_profiles','vehicle_identifier_mappings','product_vehicle_articles','vehicle_makes','vehicle_models','vehicle_generations','vehicle_trims','vehicle_engines','vehicle_transmissions','vehicle_body_types','vehicle_markets','vehicle_electric_motors','vehicle_battery_packs','vehicle_drive_units','vehicle_charging_systems','vehicle_configuration_electric_motors','vehicle_configuration_drive_units'] LOOP
    EXECUTE format('SELECT count(*), md5(coalesce(string_agg((to_jsonb(t) - ARRAY[''propulsion_topology'',''engine_role'',''energy_storage_role'',''external_charging_capability'',''storage_kind'',''integration_kind'',''function_roles'',''quantity''])::text, '''' ORDER BY id),'''')) FROM %I t',name) INTO count_value,digest_value;
    INSERT INTO ev_stage02_assert.digests VALUES(name,count_value,digest_value);
  END LOOP;
END
$snapshot$;

