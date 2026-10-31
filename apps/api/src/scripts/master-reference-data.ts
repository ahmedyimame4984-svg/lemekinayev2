import { createHash } from 'node:crypto';
import {
  generationProductionEndStatus,
  VEHICLE_LIBRARY,
  vehicleLibraryStats,
  validateVehicleLibrary,
} from './africa-vehicle-library.js';
import {
  MASTER_ATTRIBUTE_LIBRARY,
  validateMasterAttributeLibrary,
} from './master-attribute-library.js';

export {
  VEHICLE_LIBRARY,
  vehicleLibraryStats,
  validateVehicleLibrary,
} from './africa-vehicle-library.js';
export { validateMasterAttributeLibrary } from './master-attribute-library.js';
export {
  ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES,
  ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES,
  STRATEGIC_ETHIOPIA_AFRICA_COVERAGE,
  strategicCoverageStatus,
} from './ethiopia-africa-coverage.js';

// Product catalog classifications are intentionally not seeded.
//
// Categories, Part Groups (stored by the ProductFamily model), and Product Types
// are Admin-managed real-world master data. Keeping them out of automatic
// bootstrap prevents local/API restarts from recreating placeholder catalog
// structures after the hierarchy is corrected.
export const CATALOG_SEED_POLICY = 'ADMIN_MANAGED_REAL_DATA_ONLY' as const;

// Identity-only signature of the retired placeholder catalog. These codes are
// retained solely so the one-time cleanup can prove it is deleting the old
// generated seed rather than Admin-created real catalog data.
export const LEGACY_SEEDED_CATEGORY_CODES = [
  'ENGINE_POWERTRAIN',
  'TRANSMISSION_DRIVETRAIN',
  'BRAKING',
  'SUSPENSION_STEERING',
  'BODY_EXTERIOR',
  'LIGHTING_ELECTRICAL',
  'COOLING_CLIMATE',
  'WHEELS_TIRES',
  'FILTERS_EXHAUST',
  'SAFETY_ELECTRONICS',
  'ENGINE_COMPONENTS_CAT',
  'FUEL_SYSTEM_CAT',
  'TRANSMISSION_COMPONENTS_CAT',
  'DRIVETRAIN_COMPONENTS_CAT',
  'BRAKE_FRICTION_CAT',
  'BRAKE_HARDWARE_CAT',
  'SUSPENSION_COMPONENTS_CAT',
  'STEERING_COMPONENTS_CAT',
  'BUMPER_PANEL_CAT',
  'DOOR_MIRROR_CAT',
  'LIGHTING_COMPONENTS_CAT',
  'ELECTRICAL_COMPONENTS_CAT',
  'COOLING_COMPONENTS_CAT',
  'AC_COMPONENTS_CAT',
  'WHEEL_COMPONENTS_CAT',
  'TIRE_COMPONENTS_CAT',
  'FILTER_COMPONENTS_CAT',
  'EXHAUST_COMPONENTS_CAT',
  'SENSOR_ADAS_CAT',
  'CONTROL_SAFETY_CAT',
] as const;

export const LEGACY_SEEDED_PRODUCT_TYPE_CODES = [
  'ENGINE_COMPONENTS',
  'FUEL_SYSTEM_COMPONENTS',
  'TRANSMISSION_COMPONENTS',
  'DRIVETRAIN_COMPONENTS',
  'BRAKE_FRICTION_COMPONENTS',
  'BRAKE_HARDWARE_COMPONENTS',
  'SUSPENSION_COMPONENTS',
  'STEERING_COMPONENTS',
  'BUMPER_PANEL_COMPONENTS',
  'DOOR_MIRROR_COMPONENTS',
  'LIGHTING_COMPONENTS',
  'ELECTRICAL_COMPONENTS',
  'COOLING_COMPONENTS',
  'AC_COMPONENTS',
  'WHEEL_COMPONENTS',
  'TIRE_COMPONENTS',
  'FILTER_COMPONENTS',
  'EXHAUST_COMPONENTS',
  'SENSOR_ADAS_COMPONENTS',
  'CONTROL_SAFETY_COMPONENTS',
  'SPARK_PLUG',
  'IGNITION_COIL',
  'FUEL_PUMP',
  'FUEL_INJECTOR',
  'CLUTCH_KIT',
  'TRANSMISSION_FILTER',
  'CV_JOINT',
  'DRIVE_SHAFT',
  'BRAKE_PAD',
  'BRAKE_SHOE',
  'BRAKE_DISC',
  'BRAKE_CALIPER',
  'SHOCK_ABSORBER',
  'CONTROL_ARM',
  'TIE_ROD_END',
  'STEERING_RACK',
  'BUMPER_COVER',
  'FENDER_PANEL',
  'SIDE_MIRROR',
  'DOOR_HANDLE',
  'HEADLIGHT_ASSEMBLY',
  'TAIL_LIGHT_ASSEMBLY',
  'ALTERNATOR',
  'STARTER_MOTOR',
  'RADIATOR',
  'COOLING_FAN',
  'AC_COMPRESSOR',
  'AC_CONDENSER',
  'ALLOY_WHEEL',
  'STEEL_WHEEL',
  'PASSENGER_TIRE',
  'SUV_TRUCK_TIRE',
  'OIL_FILTER',
  'AIR_FILTER',
  'MUFFLER',
  'CATALYTIC_CONVERTER',
  'ABS_SENSOR',
  'PARKING_SENSOR',
  'ECU_MODULE',
  'AIRBAG_MODULE',
] as const;

export const COMMON_ATTRIBUTE_CODES = [
  'ATTR_POSITION',
  'ATTR_SIDE',
  'ATTR_ITEM_WEIGHT',
  'ATTR_INSTALLATION_REQUIRED',
] as const;

export const MASTER_REFERENCE_DATA = {
  attributeGroups: MASTER_ATTRIBUTE_LIBRARY.groups,
  unitDimensions: MASTER_ATTRIBUTE_LIBRARY.unitDimensions,
  optionSets: MASTER_ATTRIBUTE_LIBRARY.optionSets,
  attributes: MASTER_ATTRIBUTE_LIBRARY.attributes,
  allowedValues: MASTER_ATTRIBUTE_LIBRARY.allowedValues,
  categories: [] as const,
  productTypes: [] as const,
} as const;

export const MASTER_ATTRIBUTE_LIBRARY_VALIDATION =
  validateMasterAttributeLibrary();

export function canonicalCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

export function boundedCanonicalCode(
  value: string,
  maxLength: number,
): string {
  const canonical = canonicalCode(value);
  if (canonical.length <= maxLength) return canonical;

  const digest = createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  const prefixLength = maxLength - digest.length - 1;
  return `${canonical.slice(0, prefixLength)}_${digest}`;
}

export type CanonicalVehicleGenerationApplicability = {
  makeCode: string;
  modelCode: string;
  derivativeCode: string | null;
  generationCode: string;
  startYear: number;
  endYear: number | null;
  endStatus: 'ENDED' | 'CURRENT' | 'UNKNOWN';
};

export function vehicleLibraryGenerationApplicability(
  library = VEHICLE_LIBRARY,
): CanonicalVehicleGenerationApplicability[] {
  const result: CanonicalVehicleGenerationApplicability[] = [];

  for (const makeSpec of library) {
    for (const modelSpec of makeSpec.models) {
      for (const generationSpec of modelSpec.generations) {
        result.push({
          makeCode: makeSpec.code,
          modelCode: modelSpec.code,
          derivativeCode: generationSpec.derivative?.code ?? null,
          generationCode: generationSpec.code,
          startYear: generationSpec.startYear,
          endYear: generationSpec.endYear,
          endStatus: generationProductionEndStatus(generationSpec),
        });
      }
    }
  }

  return result.sort((a, b) =>
    [
      a.makeCode,
      a.modelCode,
      a.derivativeCode ?? '',
      a.generationCode,
    ].join(':').localeCompare(
      [
        b.makeCode,
        b.modelCode,
        b.derivativeCode ?? '',
        b.generationCode,
      ].join(':'),
    ),
  );
}

export type StoredVehicleGenerationApplicability = {
  code: string | null;
  startYear: number | null;
  endYear: number | null;
  endStatus: 'ENDED' | 'CURRENT' | 'UNKNOWN';
  derivative: { code: string } | null;
  model: {
    code: string;
    make: { code: string };
  };
};

export function matchesVehicleLibraryGenerationApplicability(
  records: readonly StoredVehicleGenerationApplicability[],
): boolean {
  const expected = vehicleLibraryGenerationApplicability();
  if (records.length !== expected.length) return false;

  const keyOf = (item: {
    model: { code: string; make: { code: string } };
    derivative: { code: string } | null;
    code: string | null;
  }) =>
    [
      item.model.make.code,
      item.model.code,
      item.derivative?.code ?? '',
      item.code ?? '',
    ].join(':');

  const actualByKey = new Map(records.map((record) => [keyOf(record), record]));

  return expected.every((item) => {
    const key = [
      item.makeCode,
      item.modelCode,
      item.derivativeCode ?? '',
      item.generationCode,
    ].join(':');
    const actual = actualByKey.get(key);

    return (
      actual !== undefined &&
      actual.startYear === item.startYear &&
      actual.endYear === item.endYear &&
      actual.endStatus === item.endStatus
    );
  });
}

export type CanonicalVehicleConfigurationApplicability = {
  code: string;
  modelYear: number | null;
  productionStartYear: number | null;
  productionStartMonth: number | null;
  productionEndYear: number | null;
  productionEndMonth: number | null;
  productionEndStatus: 'ENDED' | 'CURRENT' | 'UNKNOWN';
};

export function vehicleLibraryConfigurationApplicability(
  library = VEHICLE_LIBRARY,
): CanonicalVehicleConfigurationApplicability[] {
  const result: CanonicalVehicleConfigurationApplicability[] = [];

  for (const makeSpec of library) {
    for (const modelSpec of makeSpec.models) {
      for (const generationSpec of modelSpec.generations) {
        for (const trimSpec of generationSpec.trims) {
          for (const configurationSpec of trimSpec.configurations) {
            result.push({
              code: boundedCanonicalCode(configurationSpec.code, 80),
              modelYear: configurationSpec.modelYear ?? null,
              productionStartYear:
                configurationSpec.productionStartYear ?? null,
              productionStartMonth:
                configurationSpec.productionStartMonth ?? null,
              productionEndYear: configurationSpec.productionEndYear ?? null,
              productionEndMonth:
                configurationSpec.productionEndMonth ?? null,
              productionEndStatus: configurationSpec.productionEndStatus,
            });
          }
        }
      }
    }
  }

  return result.sort((a, b) => a.code.localeCompare(b.code));
}

export function matchesVehicleLibraryConfigurationApplicability(
  records: readonly (Omit<
    CanonicalVehicleConfigurationApplicability,
    'code'
  > & { code: string | null })[],
): boolean {
  const expected = vehicleLibraryConfigurationApplicability();
  if (records.length !== expected.length) return false;

  const actualByCode = new Map(records.map((record) => [record.code, record]));

  return expected.every((item) => {
    const actual = actualByCode.get(item.code);
    return (
      actual !== undefined &&
      actual.modelYear === item.modelYear &&
      actual.productionStartYear === item.productionStartYear &&
      actual.productionStartMonth === item.productionStartMonth &&
      actual.productionEndYear === item.productionEndYear &&
      actual.productionEndMonth === item.productionEndMonth &&
      actual.productionEndStatus === item.productionEndStatus
    );
  });
}
