import { describe, expect, it } from 'vitest';
import {
  validateVehicleProductionManifest,
  VEHICLE_DATA_STANDARD,
} from './vehicle-reconstruction-standard.js';

// Synthetic test fixture, deliberately not an importable OEM production dataset.
function fixture() {
  const master = { status: 'ACTIVE', sourceKeys: ['source'] };
  return {
    standard: VEHICLE_DATA_STANDARD,
    datasetId: 'TEST_ONLY',
    targetCountry: 'ET',
    sources: [
      {
        key: 'source',
        sourceName: 'Synthetic primary test evidence',
        sourceReference: 'TEST_ONLY',
        kind: 'OEM',
        verificationState: 'VERIFIED',
        verificationReference: 'TEST_REVIEW',
      },
    ],
    markets: [
      {
        key: 'et',
        code: 'ET',
        name: 'Ethiopia',
        kind: 'COUNTRY',
        countryCode: 'ET',
        ...master,
      },
      {
        key: 'eu',
        code: 'EU_SPEC',
        name: 'Europe specification',
        kind: 'REGION',
        regionCode: 'EUROPE',
        ...master,
      },
      {
        key: 'gcc',
        code: 'GCC_SPEC',
        name: 'GCC specification',
        kind: 'REGION',
        regionCode: 'GCC',
        ...master,
      },
    ],
    makes: [{ key: 'make', code: 'TEST_MAKE', name: 'Test Make', ...master }],
    models: [
      {
        key: 'model',
        code: 'TEST_MODEL',
        name: 'Test Model',
        makeKey: 'make',
        ...master,
      },
    ],
    derivatives: [],
    generations: [
      {
        key: 'gen',
        code: 'TEST_GEN',
        name: 'Test Generation',
        modelKey: 'model',
        startYear: 2000,
        endYear: 2010,
        endStatus: 'ENDED',
        ...master,
      },
    ],
    trims: [
      {
        key: 'trim',
        code: 'TEST_TRIM',
        name: 'Test Trim',
        generationKey: 'gen',
        startYear: 2001,
        endYear: 2009,
        ...master,
      },
    ],
    engines: [
      {
        key: 'engine',
        code: 'TEST_ENGINE',
        name: 'Test engine',
        fuelType: 'PETROL',
        startYear: 2000,
        endYear: 2010,
        ...master,
      },
    ],
    transmissions: [
      {
        key: 'tx',
        code: 'TEST_TX',
        name: 'Test transmission',
        transmissionType: 'MANUAL',
        startYear: 2000,
        endYear: 2010,
        ...master,
      },
    ],
    bodyTypes: [{ key: 'sedan', code: 'SEDAN', name: 'Sedan', ...master }],
    configurations: [
      {
        key: 'config',
        code: 'TEST_CONFIG',
        makeKey: 'make',
        modelKey: 'model',
        generationKey: 'gen',
        trimKey: 'trim',
        engineKey: 'engine',
        transmissionKey: 'tx',
        bodyTypeKey: 'sedan',
        powertrainType: 'ICE',
        driveType: 'FWD',
        steeringSide: 'LHD',
        ethiopiaRelevance: 'Synthetic test evidence only',
        marketApplicability: [
          { marketKey: 'et', role: 'TARGET' },
          { marketKey: 'eu', role: 'SOURCE' },
          { marketKey: 'gcc', role: 'SOURCE' },
        ],
        productionStartYear: 2002,
        productionEndYear: 2007,
        productionEndStatus: 'ENDED',
        ...master,
      },
    ],
  };
}
const codes = (value: unknown) =>
  validateVehicleProductionManifest(value).issues.map((issue) => issue.code);

describe('Ethiopia LHD production manifest boundary', () => {
  it('accepts one mechanical identity with multiple source markets and year-only precision', () => {
    expect(validateVehicleProductionManifest(fixture())).toMatchObject({
      valid: true,
      issues: [],
      counts: { configurations: 1 },
    });
  });
  it.each(['RHD', null, undefined])('rejects steering side %s', (steering) => {
    const data = fixture();
    Object.assign(data.configurations[0], { steeringSide: steering });
    expect(codes(data)).toContain('LHD_REQUIRED');
  });
  it('rejects duplicate identity despite different code, model-year label or source market', () => {
    const data = fixture();
    data.configurations.push({
      ...data.configurations[0],
      key: 'duplicate',
      code: 'SECOND',
      marketApplicability: [
        { marketKey: 'et', role: 'TARGET' },
        { marketKey: 'gcc', role: 'SOURCE' },
      ],
    });
    expect(codes(data)).toContain('OVERLAPPING_CONFIGURATION_IDENTITY');
  });
  it('accepts disjoint production periods for the same dimensions', () => {
    const data = fixture();
    data.configurations[0].productionEndYear = 2004;
    data.configurations.push({
      ...data.configurations[0],
      key: 'second',
      code: 'SECOND',
      productionStartYear: 2005,
      productionEndYear: 2007,
    });
    expect(codes(data)).not.toContain('OVERLAPPING_CONFIGURATION_IDENTITY');
  });
  it('treats unknown end as open for overlap, not as an invented end date', () => {
    const data = fixture();
    Object.assign(data.generations[0], { endYear: null, endStatus: 'UNKNOWN' });
    Object.assign(data.trims[0], { endYear: null });
    Object.assign(data.engines[0], { endYear: null });
    Object.assign(data.transmissions[0], { endYear: null });
    Object.assign(data.configurations[0], {
      productionEndYear: null,
      productionEndStatus: 'UNKNOWN',
    });
    data.configurations.push({
      ...data.configurations[0],
      key: 'second',
      code: 'SECOND',
      productionStartYear: 2008,
    });
    expect(codes(data)).toContain('OVERLAPPING_CONFIGURATION_IDENTITY');
  });
  it('rejects hierarchy contradictions and inactive references', () => {
    const data = fixture();
    data.models[0].makeKey = 'other';
    data.engines[0].status = 'DRAFT';
    expect(codes(data)).toEqual(
      expect.arrayContaining([
        'INVALID_REFERENCE',
        'HIERARCHY_MISMATCH',
        'INACTIVE_REFERENCE',
      ]),
    );
  });
  it('rejects duplicate names and nullable-derivative generation codes within a parent', () => {
    const data = fixture();
    data.generations.push({ ...data.generations[0], key: 'duplicate' });
    expect(codes(data)).toContain('DUPLICATE_MASTER_IDENTITY');
  });
  it.each(['generations', 'trims', 'engines', 'transmissions'] as const)(
    'enforces production containment for %s',
    (collection) => {
      const data = fixture();
      data[collection][0].endYear = 2006;
      expect(codes(data)).toContain('OUTSIDE_PARENT_RANGE');
    },
  );
  it('rejects an open configuration inside a closed trim', () => {
    const data = fixture();
    Object.assign(data.configurations[0], {
      productionEndYear: null,
      productionEndStatus: 'UNKNOWN',
    });
    expect(codes(data)).toContain('OUTSIDE_PARENT_RANGE');
  });
  it('rejects reversed months and months without a year', () => {
    const data = fixture();
    Object.assign(data.configurations[0], {
      productionStartYear: 2003,
      productionEndYear: 2003,
      productionStartMonth: 8,
      productionEndMonth: 2,
    });
    expect(codes(data)).toContain('REVERSED_RANGE');
    Object.assign(data.configurations[0], { productionEndYear: null });
    expect(codes(data)).toContain('INVALID_MONTH');
  });
  it('rejects an out-of-range model year and end-status contradictions', () => {
    const data = fixture();
    Object.assign(data.configurations[0], {
      modelYear: 2011,
      productionEndStatus: 'CURRENT',
    });
    expect(codes(data)).toEqual(
      expect.arrayContaining([
        'MODEL_YEAR_OUTSIDE_RANGE',
        'END_STATUS_CONTRADICTION',
        'CURRENT_PARENT_CONTRADICTION',
      ]),
    );
  });
  it('requires authoritative verified evidence for active master records', () => {
    const data = fixture();
    data.sources[0].kind = 'SECONDARY';
    expect(codes(data)).toEqual(
      expect.arrayContaining([
        'UNJUSTIFIED_VERIFICATION',
        'VERIFIED_PROVENANCE_REQUIRED',
      ]),
    );
  });
  it('permits unverified configuration evidence only in draft staging', () => {
    const data = fixture();
    data.sources.push({
      ...data.sources[0],
      key: 'draft',
      verificationState: 'UNVERIFIED',
    });
    data.configurations[0].status = 'DRAFT';
    data.configurations[0].sourceKeys = ['draft'];
    expect(validateVehicleProductionManifest(data).valid).toBe(true);
    data.configurations[0].status = 'ACTIVE';
    expect(codes(data)).toContain('VERIFIED_PROVENANCE_REQUIRED');
  });
  it('rejects rejected/missing sources and malformed source URLs', () => {
    const data = fixture();
    Object.assign(data.sources[0], {
      verificationState: 'REJECTED',
      sourceUrl: 'javascript:alert(1)',
    });
    expect(codes(data)).toEqual(
      expect.arrayContaining(['INVALID_PROVENANCE', 'INVALID_SOURCE_URL']),
    );
  });
  it('requires Ethiopia target and a distinct source-market assignment', () => {
    const data = fixture();
    data.configurations[0].marketApplicability = [
      { marketKey: 'eu', role: 'TARGET' },
      { marketKey: 'et', role: 'SOURCE' },
    ];
    expect(codes(data)).toEqual(
      expect.arrayContaining([
        'INVALID_TARGET_MARKET',
        'SOURCE_TARGET_CONFUSION',
        'SOURCE_TARGET_REQUIRED',
      ]),
    );
  });
  it('rejects seller/cosmetic fields, empty manifests and unknown collection types', () => {
    const data = fixture();
    Object.assign(data.configurations[0], { retailPrice: 1, color: 'red' });
    expect(codes(data)).toContain('UNKNOWN_FIELD');
    data.configurations = [];
    expect(codes(data)).toContain('EMPTY_PRODUCTION_DATASET');
    expect(codes({ standard: VEHICLE_DATA_STANDARD })).toContain(
      'COLLECTION_REQUIRED',
    );
  });
  it('defers EV/hybrid imports explicitly rather than creating fake ICE identities', () => {
    const data = fixture();
    data.configurations[0].powertrainType = 'BEV';
    expect(codes(data)).toContain('POWERTRAIN_EXTENSION_DEFERRED');
  });
  it('does not mutate supplied data', () => {
    const data = fixture();
    const before = JSON.stringify(data);
    validateVehicleProductionManifest(data);
    expect(JSON.stringify(data)).toBe(before);
  });
});
