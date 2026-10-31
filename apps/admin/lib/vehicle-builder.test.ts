import { describe, expect, it } from 'vitest';
import type {
  VehicleConfigurationRecord,
  VehicleGenerationRecord,
  VehicleMakeRecord,
  VehicleModelDerivativeRecord,
  VehicleModelRecord,
  VehicleTrimRecord,
} from './vehicle-contracts';
import {
  configuredVehicleHierarchy,
  configurationApplicabilityLabel,
  configurationYearBounds,
  createVehicleConfigurationCode,
  engineTechnicalLabel,
  generationsForModel,
  technicalMastersForSelection,
  transmissionTechnicalLabel,
  trimsForGeneration,
} from './vehicle-builder';

describe('vehicle builder helpers', () => {
  it('filters and sorts generations under the selected model', () => {
    const rows = generationsForModel(
      [
        {
          id: 'g2',
          modelId: 'm1',
          derivativeId: null,
          code: 'E210',
          name: 'E210',
          startYear: 2018,
          endYear: null,
          endStatus: 'UNKNOWN',
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'g1',
          modelId: 'm1',
          derivativeId: null,
          code: 'E140',
          name: 'E140',
          startYear: 2006,
          endYear: 2013,
          endStatus: 'ENDED',
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'other',
          modelId: 'm2',
          derivativeId: null,
          code: 'OTHER',
          name: 'Other',
          startYear: 2000,
          endYear: 2005,
          endStatus: 'ENDED',
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
      'm1',
    );

    expect(rows.map((row) => row.id)).toEqual(['g1', 'g2']);
  });

  it('filters trims under the selected generation', () => {
    const rows = trimsForGeneration(
      [
        {
          id: 't2',
          generationId: 'g1',
          code: 'XLI',
          name: 'XLI',
          equipmentLevel: null,
          startYear: null,
          endYear: null,
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 't1',
          generationId: 'g1',
          code: 'GLI',
          name: 'GLI',
          equipmentLevel: null,
          startYear: null,
          endYear: null,
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
      'g1',
    );

    expect(rows.map((row) => row.id)).toEqual(['t1', 't2']);
  });

  it('shows engine technical data without repeating vehicle identity', () => {
    expect(
      engineTechnicalLabel({
        id: 'engine-1',
        code: 'CHEVROLET_SILVERADO_1500_2019_CURRENT_WT_ENGINE',
        name: 'Chevrolet Silverado 1500 WT petrol powertrain',
        family: 'Canonical reference powertrain',
        displacementCc: null,
        fuelType: 'PETROL',
        cylinderCount: null,
        aspiration: null,
        powerKw: null,
        torqueNm: null,
        startYear: 2025,
        endYear: 2025,
        status: 'ACTIVE',
        version: 1,
        createdAt: '',
        updatedAt: '',
      }),
    ).toBe('PETROL');
  });

  it('shows transmission technical data without exposing the long canonical code', () => {
    expect(
      transmissionTechnicalLabel({
        id: 'trans-1',
        code: 'CHEVROLET_SILVERADO_1500_2019_CURRENT_WT_TRANS',
        transmissionType: 'AUTOMATIC',
        gearCount: null,
        driveType: 'RWD',
        startYear: 2025,
        endYear: 2025,
        status: 'ACTIVE',
        version: 1,
        createdAt: '',
        updatedAt: '',
      }),
    ).toBe('AUTOMATIC · RWD');
  });

  it('filters technical masters from the selected saved vehicle hierarchy', () => {
    const models = [
      {
        id: 'toyota-model',
        makeId: 'toyota',
        code: 'HILUX',
        name: 'Hilux',
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'nissan-model',
        makeId: 'nissan',
        code: 'NAVARA',
        name: 'Navara',
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const generations = [
      {
        id: 'hilux-gen',
        modelId: 'toyota-model',
        derivativeId: null,
        code: 'AN120',
        name: 'AN120 / AN130',
        startYear: 2015,
        endYear: null,
        endStatus: 'CURRENT' as const,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const trims = [
      {
        id: 'hilux-trim',
        generationId: 'hilux-gen',
        code: 'RAIDER',
        name: 'Raider',
        equipmentLevel: 'Raider',
        startYear: 2016,
        endYear: null,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const engines = [
      {
        id: 'toyota-engine',
        code: '2GD-FTV',
        name: '2GD-FTV 2.4L GD turbo diesel',
        family: null,
        displacementCc: 2393,
        fuelType: 'DIESEL',
        cylinderCount: 4,
        aspiration: 'TURBOCHARGED',
        powerKw: null,
        torqueNm: null,
        startYear: 2015,
        endYear: null,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'nissan-engine',
        code: 'YD25DDTi',
        name: 'YD25DDTi 2.5L turbo diesel',
        family: null,
        displacementCc: 2488,
        fuelType: 'DIESEL',
        cylinderCount: 4,
        aspiration: 'TURBOCHARGED',
        powerKw: 140,
        torqueNm: 450,
        startYear: 2015,
        endYear: null,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const transmissions = [
      {
        id: 'six-mt',
        code: null,
        transmissionType: 'MANUAL',
        gearCount: 6,
        driveType: '4WD',
        startYear: 2015,
        endYear: null,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'seven-at',
        code: null,
        transmissionType: 'AUTOMATIC',
        gearCount: 7,
        driveType: '4WD',
        startYear: 2015,
        endYear: null,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const configurations = [
      {
        id: 'hilux-config',
        identityCode: 'VC-HILUX-CONFIG',
        code: 'HILUX_CONFIG',
        makeId: 'toyota',
        modelId: 'toyota-model',
        generationId: 'hilux-gen',
        trimId: 'hilux-trim',
        engineId: 'toyota-engine',
        transmissionId: 'six-mt',
        bodyTypeId: 'pickup',
        marketId: 'ethiopia',
        modelYear: null,
        productionStartYear: 2016,
        productionStartMonth: null,
        productionEndYear: null,
        productionEndMonth: null,
        productionEndStatus: 'CURRENT' as const,
        steeringSide: 'LHD' as const,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'navara-config',
        identityCode: 'VC-NAVARA-CONFIG',
        code: 'NAVARA_CONFIG',
        makeId: 'nissan',
        modelId: 'nissan-model',
        generationId: null,
        trimId: null,
        engineId: 'nissan-engine',
        transmissionId: 'seven-at',
        bodyTypeId: 'pickup',
        marketId: 'ethiopia',
        modelYear: null,
        productionStartYear: 2016,
        productionStartMonth: null,
        productionEndYear: null,
        productionEndMonth: null,
        productionEndStatus: 'CURRENT' as const,
        steeringSide: 'LHD' as const,
        status: 'ACTIVE' as const,
        version: 1,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const options = technicalMastersForSelection(
      configurations,
      models,
      generations,
      trims,
      engines,
      transmissions,
      {
        modelId: 'toyota-model',
        generationId: 'hilux-gen',
        trimId: 'hilux-trim',
      },
    );

    expect(options.engines.map((item) => item.id)).toEqual(['toyota-engine']);
    expect(options.transmissions.map((item) => item.id)).toEqual(['six-mt']);
    expect(options.bodyTypeIds).toEqual(['pickup']);
    expect(options.marketIds).toEqual(['ethiopia']);
    expect(options.steeringSides).toEqual(['LHD']);
    expect(options.relatedConfigurationCount).toBe(1);
  });

  it('intersects generation and trim years for configured-vehicle input bounds', () => {
    expect(
      configurationYearBounds(
        {
          id: 'generation',
          modelId: 'model',
          derivativeId: null,
          code: 'E210',
          name: 'E210',
          startYear: 2019,
          endYear: 2026,
          endStatus: 'ENDED',
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'trim',
          generationId: 'generation',
          code: 'GLI',
          name: 'GLI',
          equipmentLevel: null,
          startYear: 2021,
          endYear: 2025,
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
      ),
    ).toEqual({ min: 2021, max: 2025 });
  });

  it('creates a canonical configuration code from selected identity parts', () => {
    expect(
      createVehicleConfigurationCode([
        'Toyota',
        'Corolla',
        'E140',
        'GLI',
        '2ZR-FE',
        '5MT',
      ]),
    ).toBe('VEH_TOYOTA_COROLLA_E140_GLI_2ZR_FE_5MT');
  });
});


describe('configured vehicle library hierarchy', () => {
  const timestamp = '2026-10-02T00:00:00.000Z';

  const make: VehicleMakeRecord = {
    id: 'toyota',
    code: 'TOYOTA',
    name: 'Toyota',
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const model: VehicleModelRecord = {
    id: 'corolla',
    makeId: make.id,
    code: 'COROLLA',
    name: 'Corolla',
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const derivative: VehicleModelDerivativeRecord = {
    id: 'sedan',
    modelId: model.id,
    code: 'SEDAN',
    name: 'Sedan',
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const generation: VehicleGenerationRecord = {
    id: 'e140',
    modelId: model.id,
    derivativeId: derivative.id,
    code: 'E140',
    name: 'E140',
    startYear: 2006,
    endYear: 2013,
    endStatus: 'ENDED',
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const gli: VehicleTrimRecord = {
    id: 'gli',
    generationId: generation.id,
    code: 'GLI',
    name: 'GLI',
    equipmentLevel: 'GLI',
    startYear: 2007,
    endYear: 2013,
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  function configuration(
    id: string,
    input: {
      modelYear?: number | null;
      productionStartYear?: number | null;
      productionStartMonth?: number | null;
      productionEndYear?: number | null;
      productionEndMonth?: number | null;
      productionEndStatus?: 'ENDED' | 'CURRENT' | 'UNKNOWN';
    },
  ): VehicleConfigurationRecord {
    return {
      id,
      identityCode: `VC-${id.toUpperCase()}`,
      code: id.toUpperCase(),
      makeId: make.id,
      modelId: model.id,
      generationId: generation.id,
      trimId: gli.id,
      engineId: 'engine',
      transmissionId: 'transmission',
      bodyTypeId: 'sedan-body',
      marketId: 'ethiopia',
      modelYear: input.modelYear ?? null,
      productionStartYear: input.productionStartYear ?? null,
      productionStartMonth: input.productionStartMonth ?? null,
      productionEndYear: input.productionEndYear ?? null,
      productionEndMonth: input.productionEndMonth ?? null,
      productionEndStatus: input.productionEndStatus ?? 'UNKNOWN',
      steeringSide: 'LHD',
      status: 'ACTIVE',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  it('keeps year applicability as configuration metadata instead of a hierarchy level', () => {
    const library = configuredVehicleHierarchy(
      [
        configuration('corolla-2008', {
          modelYear: 2008,
          productionStartYear: 2007,
          productionEndYear: 2010,
          productionEndStatus: 'ENDED',
        }),
      ],
      [make],
      [model],
      [derivative],
      [generation],
      [gli],
    );

    expect(library).toHaveLength(1);
    expect(library[0]?.make.name).toBe('Toyota');
    expect(library[0]?.models[0]?.model.name).toBe('Corolla');

    const generationGroup = library[0]?.models[0]?.generations[0];
    expect(generationGroup?.generation?.name).toBe('E140');
    expect(generationGroup?.derivative?.name).toBe('Sedan');
    expect(generationGroup?.trims[0]?.trim?.name).toBe('GLI');
    expect(generationGroup?.trims[0]?.configurations[0]?.modelYear).toBe(2008);
  });

  it('shows finite production applicability and model year without letting one hide the other', () => {
    expect(
      configurationApplicabilityLabel(
        configuration('corolla-range', {
          modelYear: 2011,
          productionStartYear: 2010,
          productionStartMonth: 3,
          productionEndYear: 2013,
          productionEndMonth: 8,
          productionEndStatus: 'ENDED',
        }),
      ),
    ).toBe('Production 03/2010–08/2013 · Model year 2011');
  });

  it('distinguishes current production from an unverified open end', () => {
    expect(
      configurationApplicabilityLabel(
        configuration('corolla-current', {
          productionStartYear: 2023,
          productionEndStatus: 'CURRENT',
        }),
      ),
    ).toBe('Production 2023–present');

    expect(
      configurationApplicabilityLabel(
        configuration('corolla-unknown', {
          productionStartYear: 2023,
          productionEndStatus: 'UNKNOWN',
        }),
      ),
    ).toBe('Production from 2023 · end not verified');
  });

  it('supports open-ended current configurations without changing hierarchy filters', () => {
    const currentGeneration: VehicleGenerationRecord = {
      ...generation,
      id: 'e210',
      derivativeId: null,
      code: 'E210',
      name: 'E210',
      startYear: 2019,
      endYear: null,
    };
    const currentTrim: VehicleTrimRecord = {
      ...gli,
      id: 'xr',
      generationId: currentGeneration.id,
      code: 'XR',
      name: 'XR',
      startYear: 2023,
      endYear: null,
    };
    const currentConfig: VehicleConfigurationRecord = {
      ...configuration('corolla-current-filter', {
        productionStartYear: 2023,
        productionEndStatus: 'CURRENT',
      }),
      generationId: currentGeneration.id,
      trimId: currentTrim.id,
    };

    const library = configuredVehicleHierarchy(
      [currentConfig],
      [make],
      [model],
      [],
      [currentGeneration],
      [currentTrim],
      {
        makeId: make.id,
        modelId: model.id,
        generationId: currentGeneration.id,
        trimId: currentTrim.id,
      },
    );

    const generationGroup = library[0]?.models[0]?.generations[0];
    expect(generationGroup?.derivative).toBeNull();
    expect(generationGroup?.trims[0]?.trim?.name).toBe('XR');
    expect(generationGroup?.trims[0]?.configurations).toHaveLength(1);
  });
});
