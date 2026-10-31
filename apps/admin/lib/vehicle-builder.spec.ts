import { describe, expect, it } from 'vitest';
import type {
  VehicleConfigurationRecord,
  VehicleEngineRecord,
  VehicleGenerationRecord,
  VehicleModelDerivativeRecord,
  VehicleModelRecord,
  VehicleTransmissionRecord,
  VehicleTrimRecord,
} from './vehicle-contracts';
import {
  configuredVehicleLibrary,
  technicalMastersForSelection,
} from './vehicle-builder';

const timestamp = '2026-09-30T00:00:00.000Z';

function model(
  id: string,
  name: string,
  makeId = 'make-toyota',
): VehicleModelRecord {
  return {
    id,
    makeId,
    code: name.toUpperCase(),
    name,
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function derivative(
  id: string,
  modelId: string,
  name: string,
): VehicleModelDerivativeRecord {
  return {
    id,
    modelId,
    code: name.toUpperCase(),
    name,
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function generation(
  id: string,
  modelId: string,
  derivativeId: string | null,
  name: string,
  startYear: number,
): VehicleGenerationRecord {
  return {
    id,
    modelId,
    derivativeId,
    code: name.toUpperCase(),
    name,
    startYear,
    endYear: null,
    endStatus: 'UNKNOWN',
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function trim(
  id: string,
  generationId: string,
  name: string,
): VehicleTrimRecord {
  return {
    id,
    generationId,
    code: name.toUpperCase(),
    name,
    equipmentLevel: name,
    startYear: null,
    endYear: null,
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function configuration(
  id: string,
  modelId: string,
  generationId: string,
  trimId: string,
  modelYear: number,
): VehicleConfigurationRecord {
  return {
    id,
    identityCode: `VC-${id.toUpperCase()}`,
    code: `VEH_${id.toUpperCase()}`,
    makeId: 'make-toyota',
    modelId,
    generationId,
    trimId,
    engineId: 'engine-1',
    transmissionId: 'transmission-1',
    bodyTypeId: null,
    marketId: null,
    modelYear,
    productionStartYear: modelYear,
    productionStartMonth: null,
    productionEndYear: modelYear,
    productionEndMonth: null,
    productionEndStatus: 'ENDED',
    steeringSide: null,
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function engine(
  id: string,
  startYear: number | null,
  endYear: number | null,
): VehicleEngineRecord {
  return {
    id,
    code: id.toUpperCase(),
    name: id,
    family: null,
    displacementCc: null,
    fuelType: 'PETROL',
    cylinderCount: null,
    aspiration: null,
    powerKw: null,
    torqueNm: null,
    startYear,
    endYear,
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function transmission(
  id: string,
  startYear: number | null,
  endYear: number | null,
): VehicleTransmissionRecord {
  return {
    id,
    code: id.toUpperCase(),
    transmissionType: id,
    gearCount: null,
    driveType: 'FWD',
    startYear,
    endYear,
    status: 'ACTIVE',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('configured vehicle library', () => {
  it('keeps Saloon and Verso under Corolla with many generations per derivative', () => {
    const models = [model('corolla', 'Corolla')];
    const derivatives = [
      derivative('saloon', 'corolla', 'Saloon'),
      derivative('verso', 'corolla', 'Verso'),
    ];
    const generations = [
      generation('e120', 'corolla', 'saloon', 'E120', 2000),
      generation('e140', 'corolla', 'saloon', 'E140', 2006),
      generation('ar10', 'corolla', 'verso', 'AR10', 2004),
    ];
    const trims = [
      trim('gli-120', 'e120', 'GLI'),
      trim('gli-140', 'e140', 'GLI'),
      trim('sol-ar10', 'ar10', 'SOL'),
    ];
    const configurations = [
      configuration('e120-gli', 'corolla', 'e120', 'gli-120', 2005),
      configuration('e140-gli', 'corolla', 'e140', 'gli-140', 2008),
      configuration('ar10-sol', 'corolla', 'ar10', 'sol-ar10', 2007),
    ];

    const library = configuredVehicleLibrary(
      configurations,
      models,
      derivatives,
      generations,
      trims,
    );

    expect(library).toHaveLength(1);
    expect(library[0]?.model.name).toBe('Corolla');
    expect(library[0]?.derivatives.map((group) => group.derivative?.name)).toEqual([
      'Saloon',
      'Verso',
    ]);
    expect(
      library[0]?.derivatives[0]?.generations.map(
        (group) => group.generation?.name,
      ),
    ).toEqual(['E120', 'E140']);
    expect(
      library[0]?.derivatives[1]?.generations.map(
        (group) => group.generation?.name,
      ),
    ).toEqual(['AR10']);
  });

  it('sorts configured vehicles by model year inside each generation', () => {
    const models = [model('corolla', 'Corolla')];
    const derivatives = [derivative('saloon', 'corolla', 'Saloon')];
    const generations = [
      generation('e140', 'corolla', 'saloon', 'E140', 2006),
    ];
    const trims = [trim('gli', 'e140', 'GLI')];
    const configurations = [
      configuration('newer', 'corolla', 'e140', 'gli', 2010),
      configuration('older', 'corolla', 'e140', 'gli', 2008),
    ];

    const library = configuredVehicleLibrary(
      configurations,
      models,
      derivatives,
      generations,
      trims,
    );

    expect(
      library[0]?.derivatives[0]?.generations[0]?.trims[0]?.configurations.map(
        (item) => item.modelYear,
      ),
    ).toEqual([2008, 2010]);
  });

  it('filters by derivative without changing the hierarchy', () => {
    const models = [model('corolla', 'Corolla')];
    const derivatives = [
      derivative('saloon', 'corolla', 'Saloon'),
      derivative('verso', 'corolla', 'Verso'),
    ];
    const generations = [
      generation('e140', 'corolla', 'saloon', 'E140', 2006),
      generation('ar10', 'corolla', 'verso', 'AR10', 2004),
    ];
    const trims = [
      trim('gli', 'e140', 'GLI'),
      trim('sol', 'ar10', 'SOL'),
    ];
    const configurations = [
      configuration('e140-gli', 'corolla', 'e140', 'gli', 2008),
      configuration('ar10-sol', 'corolla', 'ar10', 'sol', 2007),
    ];

    const library = configuredVehicleLibrary(
      configurations,
      models,
      derivatives,
      generations,
      trims,
      { derivativeId: 'verso' },
    );

    expect(library).toHaveLength(1);
    expect(library[0]?.derivatives).toHaveLength(1);
    expect(library[0]?.derivatives[0]?.derivative?.name).toBe('Verso');
    expect(
      library[0]?.derivatives[0]?.generations[0]?.generation?.name,
    ).toBe('AR10');
  });

  it('groups configurations under trim without duplicating the model', () => {
    const models = [model('corolla', 'Corolla')];
    const generations = [
      generation('e140', 'corolla', null, 'E140', 2006),
    ];
    const trims = [
      trim('gli', 'e140', 'GLI'),
      trim('xli', 'e140', 'XLI'),
    ];
    const configurations = [
      configuration('gli-manual', 'corolla', 'e140', 'gli', 2008),
      configuration('gli-auto', 'corolla', 'e140', 'gli', 2008),
      configuration('xli-auto', 'corolla', 'e140', 'xli', 2008),
    ];

    const library = configuredVehicleLibrary(
      configurations,
      models,
      [],
      generations,
      trims,
    );

    expect(library).toHaveLength(1);
    expect(library[0]?.model.name).toBe('Corolla');

    const trimGroups = library[0]?.derivatives[0]?.generations[0]?.trims;
    expect(trimGroups?.map((group) => group.trim?.name)).toEqual([
      'GLI',
      'XLI',
    ]);
    expect(trimGroups?.[0]?.configurations).toHaveLength(2);
    expect(trimGroups?.[1]?.configurations).toHaveLength(1);
  });

  it('supports models such as bZ4X whose generations belong directly to the model', () => {
    const models = [model('bz4x', 'bZ4X')];
    const generations = [
      generation('bz4x-gen1', 'bz4x', null, 'Generation 1', 2022),
    ];
    const trims = [trim('bz4x-awd', 'bz4x-gen1', 'AWD')];
    const configurations = [
      configuration(
        'bz4x-gen1-awd',
        'bz4x',
        'bz4x-gen1',
        'bz4x-awd',
        2023,
      ),
    ];

    const library = configuredVehicleLibrary(
      configurations,
      models,
      [],
      generations,
      trims,
    );

    expect(library).toHaveLength(1);
    expect(library[0]?.model.name).toBe('bZ4X');
    expect(library[0]?.derivatives[0]?.derivative).toBeNull();
    expect(
      library[0]?.derivatives[0]?.generations[0]?.generation?.name,
    ).toBe('Generation 1');
  });
});

describe('technical master selection', () => {
  it('prioritizes Make-used masters without hiding searched valid alternatives', () => {
    const models = [model('corolla', 'Corolla')];
    const generations = [
      {
        ...generation('e140', 'corolla', null, 'E140', 2006),
        endYear: 2013,
        endStatus: 'ENDED' as const,
      },
    ];
    const trims = [trim('gli', 'e140', 'GLI')];
    const configurations = [
      configuration('known', 'corolla', 'e140', 'gli', 2008),
    ];
    const engines = [
      engine('engine-new', 2007, 2012),
      engine('engine-1', 2006, 2013),
      engine('engine-too-new', 2020, 2024),
    ];
    const transmissions = [
      transmission('transmission-new', 2007, 2012),
      transmission('transmission-1', 2006, 2013),
    ];

    const result = technicalMastersForSelection(
      configurations,
      models,
      generations,
      trims,
      engines,
      transmissions,
      {
        modelId: 'corolla',
        generationId: 'e140',
        trimId: 'gli',
      },
    );

    expect(result.engines.map((item) => item.id)).toEqual([
      'engine-1',
      'engine-new',
    ]);
    expect(result.transmissions.map((item) => item.id)).toEqual([
      'transmission-1',
      'transmission-new',
    ]);
  });
});
