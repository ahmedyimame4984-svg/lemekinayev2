-- ATD-07 v2.1 opt-in: isolated canonical rule mirror. No seller/commercial tables.
CREATE TABLE "reference_sync_vehicle_identifier_rules" (
  "id" UUID PRIMARY KEY,
  "identifier_type" "VehicleIdentificationMethod" NOT NULL,
  "specificity" VARCHAR(32) NOT NULL,
  "market_code" VARCHAR(16),
  "wmi" VARCHAR(3),
  "vds_pattern" VARCHAR(5),
  "plant_code" VARCHAR(1),
  "chassis_prefix" VARCHAR(32),
  "serial_digits" INTEGER,
  "year_from" INTEGER,
  "year_to" INTEGER,
  "check_digit_policy" VARCHAR(32) NOT NULL,
  "year_code_policy" VARCHAR(32) NOT NULL,
  "make_id" UUID NOT NULL,
  "model_id" UUID,
  "configuration_id" UUID,
  "source_name" VARCHAR(160) NOT NULL,
  "source_reference" VARCHAR(255) NOT NULL,
  "evidence_reference" VARCHAR(255) NOT NULL,
  "rights_scope" VARCHAR(32) NOT NULL,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_vin_rule_rights_check" CHECK ("rights_scope" IN ('B2B_DISTRIBUTION','PUBLIC_LOOKUP')),
  CONSTRAINT "sync_vin_rule_status_check" CHECK ("status" IN ('ACTIVE','DEPRECATED','ARCHIVED')),
  CONSTRAINT "sync_vin_rule_type_check" CHECK ("identifier_type" IN ('VIN','CHASSIS','FRAME'))
);
ALTER TABLE "reference_sync_vehicle_identifier_rules"
  ADD CONSTRAINT "sync_vin_rule_make_fkey" FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "sync_vin_rule_model_fkey" FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "sync_vin_rule_config_fkey" FOREIGN KEY ("configuration_id") REFERENCES "vehicle_configurations"("id") ON DELETE RESTRICT;
CREATE INDEX "sync_vin_rule_wmi_idx" ON "reference_sync_vehicle_identifier_rules"("identifier_type","wmi","status");
CREATE INDEX "sync_vin_rule_chassis_idx" ON "reference_sync_vehicle_identifier_rules"("identifier_type","chassis_prefix","status");
CREATE INDEX "sync_vin_rule_make_model_idx" ON "reference_sync_vehicle_identifier_rules"("make_id","model_id","status");
