import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  MASTER_REFERENCE_DATA,
  vehicleLibraryStats,
} from '../scripts/master-reference-data.js';
import { AdminReferenceDataController } from './admin-reference-data.controller.js';
import type {
  AttributeMasterInstallResult,
  MasterReferenceInstallResult,
  MasterReferenceService,
  MasterReferenceStatus,
} from './master-reference.service.js';
import type { StrategicVehicleCoverageService } from './strategic-vehicle-coverage.service.js';

function attributeMasterCounts() {
  return {
    attributeGroups: MASTER_REFERENCE_DATA.attributeGroups.length,
    unitDimensions: MASTER_REFERENCE_DATA.unitDimensions.length,
    attributeUnits: MASTER_REFERENCE_DATA.unitDimensions.reduce(
      (total, dimension) => total + dimension.units.length,
      0,
    ),
    optionSets: MASTER_REFERENCE_DATA.optionSets.length,
    optionValues: MASTER_REFERENCE_DATA.optionSets.reduce(
      (total, optionSet) => total + optionSet.values.length,
      0,
    ),
    attributes: MASTER_REFERENCE_DATA.attributes.length,
    attributeAliases: MASTER_REFERENCE_DATA.attributes.reduce(
      (total, attribute) => total + attribute.aliases.length,
      0,
    ),
    allowedValues: MASTER_REFERENCE_DATA.allowedValues.length,
  };
}

function strategicCoverageStub(
  reconcile = vi.fn(),
): StrategicVehicleCoverageService {
  return { reconcile } as unknown as StrategicVehicleCoverageService;
}

describe('AdminReferenceDataController', () => {
  it('returns canonical master-data status', async () => {
    const result: MasterReferenceStatus = {
      ready: true,
      attributeLibraryReady: true,
      vehicleLibraryState: 'CONFIGURATIONS_PRESENT',
      catalogManagedByAdmin: true,
      replacementInProgress: false,
      counts: {
        attributeGroups: {
          actual: attributeMasterCounts().attributeGroups,
          expected: attributeMasterCounts().attributeGroups,
        },
        unitDimensions: {
          actual: attributeMasterCounts().unitDimensions,
          expected: attributeMasterCounts().unitDimensions,
        },
        attributeUnits: {
          actual: attributeMasterCounts().attributeUnits,
          expected: attributeMasterCounts().attributeUnits,
        },
        optionSets: {
          actual: attributeMasterCounts().optionSets,
          expected: attributeMasterCounts().optionSets,
        },
        optionValues: {
          actual: attributeMasterCounts().optionValues,
          expected: attributeMasterCounts().optionValues,
        },
        attributes: {
          actual: attributeMasterCounts().attributes,
          expected: attributeMasterCounts().attributes,
        },
        attributeAliases: {
          actual: attributeMasterCounts().attributeAliases,
          expected: attributeMasterCounts().attributeAliases,
        },
        allowedValues: {
          actual: attributeMasterCounts().allowedValues,
          expected: attributeMasterCounts().allowedValues,
        },
        rootCategories: { actual: 2, expected: null },
        subcategories: { actual: 3, expected: null },
        categories: { actual: 5, expected: null },
        parentProductTypes: { actual: 3, expected: null },
        childProductTypes: { actual: 5, expected: null },
        productTypes: { actual: 8, expected: null },
        vehicleMakes: { actual: 2, expected: null },
        vehicleModels: { actual: 4, expected: null },
        vehicleDerivatives: { actual: 1, expected: null },
        vehicleGenerations: { actual: 3, expected: null },
        vehicleTrims: { actual: 4, expected: null },
        vehicleEngines: { actual: 2, expected: null },
        vehicleTransmissions: { actual: 2, expected: null },
        vehicleBodyTypes: { actual: 5, expected: null },
        vehicleMarkets: { actual: 2, expected: null },
        vehicleConfigurations: { actual: 5, expected: null },
      },
      blockers: {
        products: 0,
        sellerListings: 0,
        vehicleProfiles: 0,
        vehicleCompatibilities: 0,
      },
    };
    const status = vi.fn().mockResolvedValue(result);
    const service = { status } as unknown as MasterReferenceService;
    const controller = new AdminReferenceDataController(
      service,
      strategicCoverageStub(),
    );

    await expect(controller.status()).resolves.toEqual(result);
    expect(status).toHaveBeenCalledOnce();
  });

  it('reconciles canonical attributes in place using the signed-in Admin as actor', async () => {
    const result: AttributeMasterInstallResult = attributeMasterCounts();
    const reconcileAttributes = vi.fn().mockResolvedValue(result);
    const service = { reconcileAttributes } as unknown as MasterReferenceService;
    const controller = new AdminReferenceDataController(
      service,
      strategicCoverageStub(),
    );
    const principal = { userId: 'admin-user-id' } as AuthPrincipal;

    await expect(controller.reconcileAttributes(principal)).resolves.toEqual(
      result,
    );
    expect(reconcileAttributes).toHaveBeenCalledOnce();
    expect(reconcileAttributes).toHaveBeenCalledWith('admin-user-id');
  });

  it('reconciles strategic vehicle coverage using the signed-in Admin as actor', async () => {
    const result = {
      createdMakes: 3,
      createdModels: 5,
      createdDerivatives: 1,
      createdGenerations: 5,
      createdTrims: 7,
      createdEngines: 7,
      createdTransmissions: 5,
      createdConfigurations: 9,
      skippedExistingMakes: [
        'TOYOTA',
        'ISUZU',
        'NISSAN',
        'MITSUBISHI',
        'HYUNDAI',
        'SUZUKI',
        'FORD',
      ],
    };
    const reconcile = vi.fn().mockResolvedValue(result);
    const service = {} as MasterReferenceService;
    const controller = new AdminReferenceDataController(
      service,
      strategicCoverageStub(reconcile),
    );
    const principal = { userId: 'admin-user-id' } as AuthPrincipal;

    await expect(
      controller.reconcileStrategicVehicleCoverage(principal),
    ).resolves.toEqual(result);
    expect(reconcile).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledWith('admin-user-id');
  });

  it('replaces canonical master data using the signed-in Admin as actor', async () => {
    const result: MasterReferenceInstallResult = {
      ...attributeMasterCounts(),
      rootCategories: 0,
      subcategories: 0,
      categories: 0,
      parentProductTypes: 0,
      childProductTypes: 0,
      productTypes: 0,
      attributeAssignments: 0,
      publishedSchemas: 0,
      vehicleMakes: vehicleLibraryStats().makes,
      vehicleModels: vehicleLibraryStats().models,
      vehicleDerivatives: vehicleLibraryStats().derivatives,
      vehicleGenerations: vehicleLibraryStats().generations,
      vehicleTrims: vehicleLibraryStats().trims,
      vehicleConfigurations: vehicleLibraryStats().configurations,
    };
    const replace = vi.fn().mockResolvedValue(result);
    const service = { replace } as unknown as MasterReferenceService;
    const controller = new AdminReferenceDataController(
      service,
      strategicCoverageStub(),
    );
    const principal = { userId: 'admin-user-id' } as AuthPrincipal;

    await expect(
      controller.replace({ confirmation: 'REPLACE' }, principal),
    ).resolves.toEqual(result);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('admin-user-id');
  });
});
