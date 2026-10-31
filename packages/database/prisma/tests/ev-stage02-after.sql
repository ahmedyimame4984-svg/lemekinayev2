-- Isolated Stage 1 -> Stage 2 preservation, defaults, constraints and rollback probes.
DO $checks$
DECLARE snapshot record; count_value bigint; digest_value text; vehicle uuid; assignment uuid; original_version integer;
BEGIN
  IF current_database() <> 'lemekinaye_ev_stage02_upgrade_utf8' THEN
    RAISE EXCEPTION 'Checks require the isolated Stage 2 upgrade database';
  END IF;
  IF (SELECT count(*) FROM ev_stage02_assert.digests) <> 19 THEN RAISE EXCEPTION 'Missing preservation snapshots'; END IF;
  FOR snapshot IN SELECT * FROM ev_stage02_assert.digests LOOP
    EXECUTE format('SELECT count(*), md5(coalesce(string_agg((to_jsonb(t) - ARRAY[''propulsion_topology'',''engine_role'',''energy_storage_role'',''external_charging_capability'',''storage_kind'',''integration_kind'',''function_roles'',''quantity''])::text, '''' ORDER BY id),'''')) FROM %I t',snapshot.name) INTO count_value,digest_value;
    IF count_value <> snapshot.row_count OR digest_value <> snapshot.digest THEN RAISE EXCEPTION 'Preservation failed: %',snapshot.name; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM vehicle_configurations WHERE propulsion_topology IS NOT NULL OR engine_role IS NOT NULL OR energy_storage_role IS NOT NULL OR external_charging_capability IS NOT NULL)
    OR EXISTS (SELECT 1 FROM vehicle_battery_packs WHERE storage_kind IS NOT NULL)
    OR EXISTS (SELECT 1 FROM vehicle_drive_units WHERE integration_kind IS NOT NULL)
    OR EXISTS (SELECT 1 FROM vehicle_configuration_electric_motors WHERE quantity <> 1 OR function_roles <> ARRAY[]::"VehicleElectricMachineFunction"[])
    OR EXISTS (SELECT 1 FROM vehicle_configuration_drive_units WHERE quantity <> 1 OR function_roles <> ARRAY[]::"VehicleElectricMachineFunction"[]) THEN
    RAISE EXCEPTION 'Migration inferred technical claims or changed structural defaults';
  END IF;
  SELECT id,version INTO STRICT vehicle,original_version FROM vehicle_configurations WHERE code='EVTEST-DRAFT';
  SELECT id INTO STRICT assignment FROM vehicle_configuration_electric_motors WHERE configuration_id=vehicle;
  BEGIN
    UPDATE vehicle_configuration_electric_motors SET quantity=0 WHERE id=assignment;
    RAISE EXCEPTION 'Zero quantity accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE vehicle_configuration_drive_units SET quantity=-1 WHERE configuration_id=vehicle;
    RAISE EXCEPTION 'Negative quantity accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM vehicle_electric_motors WHERE id=(SELECT electric_motor_id FROM vehicle_configuration_electric_motors WHERE id=assignment);
    RAISE EXCEPTION 'Referenced motor deletion accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO vehicle_configuration_electric_motors(id,configuration_id,electric_motor_id,position)
      SELECT gen_random_uuid(),configuration_id,electric_motor_id,position FROM vehicle_configuration_electric_motors WHERE id=assignment;
    RAISE EXCEPTION 'Duplicate assignment accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE vehicle_configurations SET version=version+1,propulsion_topology='ELECTRIC_ONLY' WHERE id=vehicle;
    UPDATE vehicle_configuration_electric_motors SET quantity=2,function_roles=ARRAY['TRACTION','GENERATION']::"VehicleElectricMachineFunction"[] WHERE id=assignment;
    UPDATE vehicle_configuration_drive_units SET quantity=2 WHERE configuration_id=vehicle;
    RAISE EXCEPTION USING ERRCODE='Z0022',MESSAGE='Deliberate fixture rollback';
  EXCEPTION WHEN SQLSTATE 'Z0022' THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM vehicle_configurations WHERE id=vehicle AND version=original_version AND propulsion_topology IS NULL)
    OR NOT EXISTS (SELECT 1 FROM vehicle_configuration_electric_motors WHERE id=assignment AND quantity=1 AND function_roles=ARRAY[]::"VehicleElectricMachineFunction"[]) THEN
    RAISE EXCEPTION 'Parent/assignment rollback failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vehicle_configurations WHERE code='EVTEST-ACTIVE' AND powertrain_type IS NULL AND status='ACTIVE' AND version=3) THEN
    RAISE EXCEPTION 'Legacy NULL Active identity changed';
  END IF;
  RAISE NOTICE 'PASS: 19 table counts/digests; semantic NULLs; defaults; quantity, FK and unique constraints; rollback; legacy Active identity';
END
$checks$;
