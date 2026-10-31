-- Run after the EV migration in the isolated database with the before fixture.
-- Component/assignment mutation checks roll themselves back via a subtransaction.
DO $checks$
DECLARE
  actor uuid;
  vehicle uuid;
  motor uuid := gen_random_uuid();
  battery uuid := gen_random_uuid();
  drive uuid := gen_random_uuid();
  charger uuid := gen_random_uuid();
BEGIN
  IF current_database() <> 'lemekinaye_ev_stage01_test' THEN
    RAISE EXCEPTION 'Checks require the isolated EV test database';
  END IF;
  SELECT id INTO STRICT actor FROM users WHERE name='EVTEST synthetic actor';
  SELECT id INTO STRICT vehicle FROM vehicle_configurations WHERE code='EVTEST-ACTIVE';
  IF (SELECT count(*) FROM vehicle_configurations) <> 2 OR EXISTS (
    SELECT 1 FROM vehicle_configurations WHERE powertrain_type IS NOT NULL
      OR battery_pack_id IS NOT NULL OR charging_system_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Historical configurations were changed or classified';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vehicle_configurations WHERE id=vehicle AND status='ACTIVE'
    AND version=3 AND engine_id IS NOT NULL AND transmission_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Legacy Active engine/transmission identity changed';
  END IF;
  IF (SELECT count(*) FROM vehicle_profiles) <> 2
    OR (SELECT count(*) FROM vehicle_identifier_mappings) <> 2
    OR NOT EXISTS (SELECT 1 FROM vehicle_profiles WHERE user_id=actor
      AND vehicle_configuration_id=vehicle AND identification_method='VIN'
      AND identifier_value='ZZZ00000000000001' AND vin='ZZZ00000000000001'
      AND identifier_provider='EVTEST' AND vin_provider='EVTEST')
    OR NOT EXISTS (SELECT 1 FROM vehicle_identifier_mappings WHERE identifier_type='VIN'
      AND normalized_identifier='ZZZ00000000000001' AND raw_identifier='ZZZ00000000000001'
      AND vehicle_configuration_id=vehicle AND provider='EVTEST'
      AND source_reference='EVTEST synthetic VIN; not a real vehicle') THEN
    RAISE EXCEPTION 'Synthetic garage or VIN mapping preservation failed';
  END IF;
  BEGIN
    INSERT INTO vehicle_electric_motors (id,name,created_by_id,updated_by_id,updated_at)
      VALUES (motor,'EVTEST motor',actor,actor,now());
    INSERT INTO vehicle_battery_packs (id,name,created_by_id,updated_by_id,updated_at)
      VALUES (battery,'EVTEST battery',actor,actor,now());
    INSERT INTO vehicle_drive_units (id,name,created_by_id,updated_by_id,updated_at)
      VALUES (drive,'EVTEST drive',actor,actor,now());
    INSERT INTO vehicle_charging_systems (id,name,ac_connector,max_ac_power_kw,created_by_id,updated_by_id,updated_at)
      VALUES (charger,'EVTEST AC-only charger','TYPE_2',7.40,actor,actor,now());
    IF NOT EXISTS (SELECT 1 FROM vehicle_electric_motors WHERE id=motor AND status='DRAFT' AND version=1)
      OR NOT EXISTS (SELECT 1 FROM vehicle_battery_packs WHERE id=battery AND status='DRAFT' AND version=1
        AND gross_capacity_kwh IS NULL AND usable_capacity_kwh IS NULL AND nominal_voltage_v IS NULL)
      OR NOT EXISTS (SELECT 1 FROM vehicle_drive_units WHERE id=drive AND status='DRAFT' AND version=1)
      OR NOT EXISTS (SELECT 1 FROM vehicle_charging_systems WHERE id=charger AND status='DRAFT' AND version=1
        AND dc_connector IS NULL AND max_dc_power_kw IS NULL) THEN
      RAISE EXCEPTION 'Draft defaults or unknown/AC-only specifications changed';
    END IF;
    INSERT INTO vehicle_configuration_electric_motors (id,configuration_id,electric_motor_id)
      VALUES (gen_random_uuid(),vehicle,motor);
    BEGIN
      INSERT INTO vehicle_configuration_electric_motors (id,configuration_id,electric_motor_id)
        VALUES (gen_random_uuid(),vehicle,motor);
      RAISE EXCEPTION 'Duplicate UNKNOWN-position motor assignment accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO vehicle_configuration_electric_motors (id,configuration_id,electric_motor_id,position)
      VALUES (gen_random_uuid(),vehicle,motor,'FRONT_AXLE'),
        (gen_random_uuid(),vehicle,motor,'REAR_AXLE');
    INSERT INTO vehicle_configuration_drive_units (id,configuration_id,drive_unit_id)
      VALUES (gen_random_uuid(),vehicle,drive);
    BEGIN
      INSERT INTO vehicle_configuration_drive_units (id,configuration_id,drive_unit_id)
        VALUES (gen_random_uuid(),vehicle,drive);
      RAISE EXCEPTION 'Duplicate UNKNOWN-position drive assignment accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      DELETE FROM vehicle_electric_motors WHERE id=motor;
      RAISE EXCEPTION 'Referenced motor deletion accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
      DELETE FROM vehicle_drive_units WHERE id=drive;
      RAISE EXCEPTION 'Referenced drive deletion accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
      UPDATE vehicle_configurations SET battery_pack_id=gen_random_uuid() WHERE id=vehicle;
      RAISE EXCEPTION 'Missing battery reference accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
      UPDATE vehicle_configurations SET charging_system_id=gen_random_uuid() WHERE id=vehicle;
      RAISE EXCEPTION 'Missing charger reference accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    UPDATE vehicle_configurations SET battery_pack_id=battery,charging_system_id=charger WHERE id=vehicle;
    BEGIN
      DELETE FROM vehicle_battery_packs WHERE id=battery;
      RAISE EXCEPTION 'Referenced battery deletion accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
      DELETE FROM vehicle_charging_systems WHERE id=charger;
      RAISE EXCEPTION 'Referenced charger deletion accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO vehicle_configuration_electric_motors (id,configuration_id,electric_motor_id)
        VALUES (gen_random_uuid(),gen_random_uuid(),motor);
      RAISE EXCEPTION 'Missing configuration reference accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO vehicle_electric_motors (id,name,created_by_id,updated_by_id,updated_at)
        VALUES (gen_random_uuid(),'EVTEST missing actor',gen_random_uuid(),actor,now());
      RAISE EXCEPTION 'Missing audit actor accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='Rollback all temporary EV test mutations';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END
$checks$;
