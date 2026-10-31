import {
  CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG,
  type CanonicalCategorySpec,
} from './canonical-product-catalog-library.js';
import {
  VEHICLE_LIBRARY,
  type AfricaVehicleMakeSpec,
} from './africa-vehicle-library.js';

export const ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES = [
  'TOYOTA',
  'ISUZU',
  'NISSAN',
  'MITSUBISHI',
  'HYUNDAI',
  'KIA',
  'SUZUKI',
  'FORD',
  'MERCEDES_BENZ',
  'CHEVROLET',
] as const;

export const ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES = [
  'OIL_FILTER',
  'AIR_FILTER',
  'FUEL_FILTER',
  'CABIN_FILTER',
  'BRAKE_PAD',
  'BRAKE_DISC',
  'BRAKE_SHOE',
  'SPARK_PLUG',
  'GLOW_PLUG',
  'SERPENTINE_BELT',
  'TIMING_BELT',
  'CLUTCH_KIT',
  'SHOCK_ABSORBER',
  'AUTOMOTIVE_BATTERY',
  'ALTERNATOR',
  'STARTER_MOTOR',
  'WATER_PUMP',
  'THERMOSTAT',
  'ENGINE_OIL',
  'ANTIFREEZE_COOLANT',
  'WIPER_BLADE',
] as const;

export type StrategicCoverageStatus = {
  valid: boolean;
  priorityMakes: {
    expected: number;
    present: number;
    missingCodes: string[];
    configurationsByMake: Record<string, number>;
  };
  serviceProductTypes: {
    expected: number;
    present: number;
    missingCodes: string[];
  };
  representedMarkets: string[];
};

export function strategicCoverageStatus(
  vehicles: readonly AfricaVehicleMakeSpec[] = VEHICLE_LIBRARY,
  catalog: readonly CanonicalCategorySpec[] =
    CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG,
): StrategicCoverageStatus {
  const configurationsByMake = new Map<string, number>();
  const representedMarkets = new Set<string>();

  for (const make of vehicles) {
    let configurations = 0;
    for (const model of make.models) {
      for (const generation of model.generations) {
        for (const trim of generation.trims) {
          configurations += trim.configurations.length;
          for (const configuration of trim.configurations) {
            representedMarkets.add(configuration.market);
          }
        }
      }
    }
    configurationsByMake.set(make.code, configurations);
  }

  const missingMakes = ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES.filter(
    (code) => (configurationsByMake.get(code) ?? 0) === 0,
  );

  const productTypeCodes = new Set(
    catalog.flatMap((category) =>
      category.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    ),
  );
  const missingServiceProductTypes =
    ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES.filter(
      (code) => !productTypeCodes.has(code),
    );

  const configurationsObject = Object.fromEntries(
    ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES.map((code) => [
      code,
      configurationsByMake.get(code) ?? 0,
    ]),
  );

  const requiredMarkets = ['ETHIOPIA', 'AFRICA', 'SOUTHERN_AFRICA'];
  const marketsReady = requiredMarkets.every((market) =>
    representedMarkets.has(market),
  );

  return {
    valid:
      missingMakes.length === 0 &&
      missingServiceProductTypes.length === 0 &&
      marketsReady,
    priorityMakes: {
      expected: ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES.length,
      present:
        ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES.length - missingMakes.length,
      missingCodes: [...missingMakes],
      configurationsByMake: configurationsObject,
    },
    serviceProductTypes: {
      expected: ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES.length,
      present:
        ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES.length -
        missingServiceProductTypes.length,
      missingCodes: [...missingServiceProductTypes],
    },
    representedMarkets: [...representedMarkets].sort(),
  };
}

export const STRATEGIC_ETHIOPIA_AFRICA_COVERAGE =
  strategicCoverageStatus();
