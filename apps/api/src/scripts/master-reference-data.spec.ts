import { describe, expect, it } from 'vitest';
import {
  CATALOG_SEED_POLICY,
  ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES,
  ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES,
  MASTER_REFERENCE_DATA as data,
  matchesVehicleLibraryConfigurationApplicability,
  matchesVehicleLibraryGenerationApplicability,
  vehicleLibraryConfigurationApplicability,
  vehicleLibraryGenerationApplicability,
  vehicleLibraryStats,
  validateVehicleLibrary,
  STRATEGIC_ETHIOPIA_AFRICA_COVERAGE,
  VEHICLE_LIBRARY,
} from './master-reference-data.js';

describe('full canonical master reference data', () => {
  it('contains the governed Master Attribute Library v2', () => {
    expect(data.attributeGroups.length).toBeGreaterThanOrEqual(20);
    expect(data.unitDimensions.length).toBeGreaterThanOrEqual(15);
    expect(data.optionSets.length).toBeGreaterThanOrEqual(25);
    expect(data.attributes.length).toBeGreaterThanOrEqual(180);
    expect(data.allowedValues.length).toBeGreaterThanOrEqual(100);

    const codes = data.attributes.map((item) => item.code);
    expect(new Set(codes).size).toBe(data.attributes.length);

    for (const code of [
      'ATTR_TRANSMISSION_TYPE',
      'ATTR_BRAKE_DISC_DIAMETER',
      'ATTR_WHEEL_DIAMETER',
      'ATTR_TIRE_SECTION_WIDTH',
      'ATTR_BATTERY_TYPE',
      'ATTR_OUTSIDE_DIAMETER',
      'ATTR_INSTALLATION_TORQUE',
      'ATTR_TERMINAL_COUNT',
      'ATTR_ITEM_WEIGHT',
    ]) {
      expect(codes).toContain(code);
    }
  });

  it('maps every canonical v2 attribute to supported engine enums', () => {
    const dataTypes = new Set([
      'TEXT',
      'LONG_TEXT',
      'INTEGER',
      'DECIMAL',
      'BOOLEAN',
      'DATE',
      'DATETIME',
      'MONEY',
      'SELECT',
      'MULTI_SELECT',
      'REFERENCE',
      'MULTI_REFERENCE',
      'COUNTRY',
      'MEASUREMENT',
      'IMAGE',
      'MULTI_IMAGE',
      'VIDEO',
      'FILE',
      'UUID',
    ]);
    const scopes = new Set([
      'PRODUCT',
      'VEHICLE',
      'COMPATIBILITY',
      'SELLER',
      'SYSTEM',
    ]);
    const valueSources = new Set(['NONE', 'STATIC', 'REFERENCE', 'DYNAMIC']);

    for (const attribute of data.attributes) {
      expect(dataTypes.has(attribute.dataType), attribute.code).toBe(true);
      expect(scopes.has(attribute.scope), attribute.code).toBe(true);
      expect(
        valueSources.has(attribute.valueSource),
        attribute.code,
      ).toBe(true);
    }
  });

  it('keeps controlled values attached to STATIC attributes', () => {
    const attributes = new Map<string, (typeof data.attributes)[number]>(
      data.attributes.map((item) => [item.code, item]),
    );
    const seen = new Set<string>();

    for (const value of data.allowedValues) {
      const attribute = attributes.get(value.attributeCode);
      expect(attribute, value.attributeCode).toBeDefined();
      expect(attribute?.valueSource, value.attributeCode).toBe('STATIC');

      const key = `${value.attributeCode}:${value.code}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it('does not seed product catalog classifications', () => {
    expect(CATALOG_SEED_POLICY).toBe('ADMIN_MANAGED_REAL_DATA_ONLY');
    expect(data.categories).toEqual([]);
    expect(data.productTypes).toEqual([]);
  });

  it('contains a large Ethiopia-first Africa vehicle library', () => {
    const stats = vehicleLibraryStats();

    expect(stats.makes).toBeGreaterThanOrEqual(10);
    expect(stats.models).toBeGreaterThanOrEqual(35);
    expect(stats.derivatives).toBeGreaterThanOrEqual(15);
    expect(stats.generations).toBeGreaterThanOrEqual(50);
    expect(stats.trims).toBeGreaterThanOrEqual(75);
    expect(stats.configurations).toBeGreaterThanOrEqual(90);
    expect(stats.engines).toBeGreaterThanOrEqual(35);
    expect(stats.transmissions).toBeGreaterThanOrEqual(15);

    const makeNames = VEHICLE_LIBRARY.map((item) => item.name);
    expect(makeNames).toEqual(
      expect.arrayContaining([
        'Toyota',
        'Nissan',
        'Mitsubishi',
        'Isuzu',
        'Suzuki',
        'Hyundai',
        'Kia',
        'Ford',
        'Mercedes-Benz',
        'Chevrolet',
      ]),
    );

    const toyota = VEHICLE_LIBRARY.find((item) => item.code === 'TOYOTA');
    const nissan = VEHICLE_LIBRARY.find((item) => item.code === 'NISSAN');
    const mitsubishi = VEHICLE_LIBRARY.find(
      (item) => item.code === 'MITSUBISHI',
    );

    expect(toyota?.models.length).toBeGreaterThanOrEqual(14);
    expect(nissan?.models.length).toBeGreaterThanOrEqual(8);
    expect(mitsubishi?.models.length).toBeGreaterThanOrEqual(7);
  });

  it('meets the explicit Ethiopia/Africa priority coverage contract', () => {
    expect(STRATEGIC_ETHIOPIA_AFRICA_COVERAGE.valid).toBe(true);
    expect(STRATEGIC_ETHIOPIA_AFRICA_COVERAGE.priorityMakes).toMatchObject({
      expected: ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES.length,
      present: ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES.length,
      missingCodes: [],
    });
    expect(
      STRATEGIC_ETHIOPIA_AFRICA_COVERAGE.serviceProductTypes,
    ).toMatchObject({
      expected: ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES.length,
      present: ETHIOPIA_AFRICA_PRIORITY_SERVICE_PRODUCT_TYPE_CODES.length,
      missingCodes: [],
    });

    for (const makeCode of ETHIOPIA_AFRICA_PRIORITY_MAKE_CODES) {
      expect(
        STRATEGIC_ETHIOPIA_AFRICA_COVERAGE.priorityMakes
          .configurationsByMake[makeCode],
        makeCode,
      ).toBeGreaterThan(0);
    }

    expect(STRATEGIC_ETHIOPIA_AFRICA_COVERAGE.representedMarkets).toEqual(
      expect.arrayContaining(['ETHIOPIA', 'AFRICA', 'SOUTHERN_AFRICA']),
    );
  });

  it('uses derivatives only as real model/body branches', () => {
    const derivativeNames = VEHICLE_LIBRARY.flatMap((make) =>
      make.models.flatMap((model) =>
        model.generations
          .map((generation) => generation.derivative?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    );

    expect(derivativeNames).toEqual(
      expect.arrayContaining([
        'Single Cab',
        'Double Cab',
        'Xtra Cab',
        '76 Station Wagon',
        '79 Single Cab',
        '79 Double Cab',
        'Panel Van',
        'Minibus',
        '3-Door',
        '5-Door',
      ]),
    );
    expect(derivativeNames).not.toContain('Standard');
    expect(derivativeNames).not.toContain('Default');
  });

  it('fingerprints generation applicability so parent CURRENT/UNKNOWN semantics are detectable', () => {
    const applicability = vehicleLibraryGenerationApplicability();

    expect(applicability).toHaveLength(vehicleLibraryStats().generations);

    const stored = applicability.map((item) => ({
      code: item.generationCode,
      startYear: item.startYear,
      endYear: item.endYear,
      endStatus: item.endStatus,
      derivative:
        item.derivativeCode === null ? null : { code: item.derivativeCode },
      model: {
        code: item.modelCode,
        make: { code: item.makeCode },
      },
    }));

    expect(matchesVehicleLibraryGenerationApplicability(stored)).toBe(true);

    const stale = stored.map((item, index) =>
      index === 0
        ? {
            ...item,
            endStatus:
              item.endStatus === 'CURRENT'
                ? ('UNKNOWN' as const)
                : ('CURRENT' as const),
          }
        : item,
    );

    expect(matchesVehicleLibraryGenerationApplicability(stale)).toBe(false);
  });

  it('fingerprints configured-vehicle applicability so stale CURRENT/UNKNOWN semantics are detectable', () => {
    const applicability = vehicleLibraryConfigurationApplicability();

    expect(applicability).toHaveLength(vehicleLibraryStats().configurations);
    expect(matchesVehicleLibraryConfigurationApplicability(applicability)).toBe(
      true,
    );

    const stale = applicability.map((item, index) =>
      index === 0
        ? {
            ...item,
            productionEndStatus:
              item.productionEndStatus === 'CURRENT'
                ? ('UNKNOWN' as const)
                : ('CURRENT' as const),
          }
        : item,
    );

    expect(matchesVehicleLibraryConfigurationApplicability(stale)).toBe(false);
  });

  it('keeps every configured vehicle year inside its generation and trim', () => {
    expect(validateVehicleLibrary()).toEqual([]);
  });

  it('rejects canonical library configurations outside technical-master year ranges', () => {
    const invalidLibrary = [
      {
        code: 'TEST',
        name: 'Test',
        models: [
          {
            code: 'MODEL',
            name: 'Model',
            bodyType: 'SEDAN',
            generations: [
              {
                code: 'G1',
                name: 'G1',
                startYear: 2000,
                endYear: 2010,
                trims: [
                  {
                    code: 'BASE',
                    name: 'Base',
                    startYear: 2000,
                    endYear: 2010,
                    configurations: [
                      {
                        code: 'TEST_MODEL_G1_BASE',
                        modelYear: 2005,
                        productionStartYear: 2004,
                        productionEndYear: 2006,
                        productionEndStatus: 'ENDED',
                        engine: {
                          key: 'ENGINE',
                          name: 'Engine',
                          startYear: 2006,
                          endYear: 2010,
                        },
                        transmission: {
                          key: 'TRANS',
                          transmissionType: 'MANUAL',
                          startYear: 2000,
                          endYear: 2010,
                        },
                        market: 'ETHIOPIA',
                        steeringSide: 'LHD',
                        source: 'Test source',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as const;

    expect(validateVehicleLibrary(invalidLibrary)).toContain(
      'configuration start outside engine: TEST_MODEL_G1_BASE',
    );
  });

  it('rejects overlapping duplicate identities in the canonical vehicle library', () => {
    const duplicateLibrary = [
      {
        code: 'TEST',
        name: 'Test',
        models: [
          {
            code: 'MODEL',
            name: 'Model',
            bodyType: 'SEDAN',
            generations: [
              {
                code: 'G1',
                name: 'G1',
                startYear: 2000,
                endYear: 2010,
                trims: [
                  {
                    code: 'BASE',
                    name: 'Base',
                    startYear: 2000,
                    endYear: 2010,
                    configurations: [
                      {
                        code: 'TEST_MODEL_2005_A',
                        modelYear: 2005,
                        productionStartYear: 2005,
                        productionEndYear: 2005,
                        productionEndStatus: 'ENDED',
                        engine: {
                          key: 'ENGINE',
                          name: 'Engine',
                          startYear: 2000,
                          endYear: 2010,
                        },
                        transmission: {
                          key: 'TRANS',
                          transmissionType: 'MANUAL',
                          startYear: 2000,
                          endYear: 2010,
                        },
                        market: 'ETHIOPIA',
                        steeringSide: 'LHD',
                        source: 'Test source',
                      },
                      {
                        code: 'TEST_MODEL_2005_B',
                        modelYear: 2005,
                        productionStartYear: 2005,
                        productionEndYear: 2005,
                        productionEndStatus: 'ENDED',
                        engine: {
                          key: 'ENGINE',
                          name: 'Engine',
                          startYear: 2000,
                          endYear: 2010,
                        },
                        transmission: {
                          key: 'TRANS',
                          transmissionType: 'MANUAL',
                          startYear: 2000,
                          endYear: 2010,
                        },
                        market: 'ETHIOPIA',
                        steeringSide: 'LHD',
                        source: 'Test source',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as const;

    expect(validateVehicleLibrary(duplicateLibrary)).toContain(
      'Overlapping duplicate configuration identity TEST_MODEL_2005_B conflicts with TEST_MODEL_2005_A',
    );
  });

  it('stores real technical masters instead of generated vehicle-name powertrains', () => {
    const engineNames = new Set<string>();
    const transmissionTypes = new Set<string>();
    const configurationCodes = new Set<string>();

    for (const make of VEHICLE_LIBRARY) {
      for (const model of make.models) {
        for (const generation of model.generations) {
          for (const trim of generation.trims) {
            expect(trim.configurations.length).toBeGreaterThan(0);
            for (const configuration of trim.configurations) {
              engineNames.add(configuration.engine.name);
              transmissionTypes.add(configuration.transmission.transmissionType);
              expect(configuration.source.trim().length).toBeGreaterThan(0);
              expect(configuration.code.length).toBeLessThanOrEqual(80);
              expect(configurationCodes.has(configuration.code)).toBe(false);
              configurationCodes.add(configuration.code);

              expect(configuration.engine.name.toLowerCase()).not.toContain(
                `${make.name.toLowerCase()} ${model.name.toLowerCase()}`,
              );
              expect(configuration.engine.name.toLowerCase()).not.toContain(
                'canonical reference powertrain',
              );
            }
          }
        }
      }
    }

    expect([...engineNames]).toEqual(
      expect.arrayContaining([
        '1HZ 4.2L naturally aspirated diesel',
        '1GD-FTV 2.8L GD turbo diesel',
        'YD25DDTi 2.5L turbo diesel · 140 kW',
        '4N15 2.4L MIVEC turbo diesel · 133 kW',
        'K15B 1.5L petrol',
        '1.0L MPI petrol',
        '1.6L T-GDi turbo petrol',
        'OM651 2.143L CDI turbo diesel · 120 kW / 360 Nm',
        '1.2L 16V petrol · 60 kW / 108 Nm',
        '2.8L Duramax turbo diesel · 144 kW / 500 Nm',
      ]),
    );
    expect([...transmissionTypes]).toEqual(
      expect.arrayContaining([
        'MANUAL',
        'AUTOMATIC',
        'CVT',
        'E-CVT',
        'DCT',
      ]),
    );
  });

  it('prioritizes vehicles used in Ethiopia and African markets', () => {
    const markets = new Set<string>();
    const configurations: string[] = [];

    for (const make of VEHICLE_LIBRARY) {
      for (const model of make.models) {
        for (const generation of model.generations) {
          for (const trim of generation.trims) {
            for (const configuration of trim.configurations) {
              markets.add(configuration.market);
              configurations.push(configuration.code);
            }
          }
        }
      }
    }

    expect(markets).toContain('ETHIOPIA');
    expect(markets).toContain('AFRICA');
    expect(markets).toContain('SOUTHERN_AFRICA');
    expect(configurations).toEqual(
      expect.arrayContaining([
        'TOY_HILUX_SC_24D_4X4_6MT',
        'TOY_LC76_1HZ_5MT',
        'NIS_KICKS_ACENTA_16_CVT',
        'NIS_URVAN_BUS_YD25_5MT',
        'MIT_TRITON_DC_24D_6MT_4X4',
        'KIA_PICANTO_JA_LX_10_5MT',
        'KIA_SPORTAGE_NQ5_GT_16T_7DCT',
        'MB_SPRINTER_W906_316CDI_6MT_RWD',
        'CHEV_SPARK_M300_L_12_5MT',
        'CHEV_TRAILBLAZER_RG_LTZ_28D_6AT_4X4',
      ]),
    );
  });

  it('keeps source-specific markets and steering sides explicit', () => {
    const southAfricaSources = new Set([
      'TOYOTA_SA_CURRENT',
      'TOYOTA_SA_LC70_2026',
      'NISSAN_SA_NAVARA',
      'NISSAN_SA_NP200',
      'MITSUBISHI_SA',
      'SUZUKI_SA',
      'HYUNDAI_SA',
      'FORD_SA',
      'KIA_SA_CURRENT',
      'CHEVROLET_SA_SPARK',
      'CHEVROLET_SA_TRAILBLAZER',
    ]);
    const ethiopiaSources = new Set([
      'TOYOTA_ETHIOPIA_FLEET',
      'NISSAN_ETHIOPIA',
    ]);

    for (const make of VEHICLE_LIBRARY) {
      for (const model of make.models) {
        for (const generation of model.generations) {
          for (const trim of generation.trims) {
            for (const configuration of trim.configurations) {
              if (southAfricaSources.has(configuration.source)) {
                expect(configuration.market, configuration.code).toBe(
                  'SOUTHERN_AFRICA',
                );
                expect(configuration.steeringSide, configuration.code).toBe(
                  'RHD',
                );
              }
              if (ethiopiaSources.has(configuration.source)) {
                expect(configuration.market, configuration.code).toBe(
                  'ETHIOPIA',
                );
                expect(configuration.steeringSide, configuration.code).toBe(
                  'LHD',
                );
              }
            }
          }
        }
      }
    }
  });

  it('keeps canonical attribute/value fields within schema limits', () => {
    for (const attribute of data.attributes) {
      expect(attribute.code.length, attribute.code).toBeLessThanOrEqual(75);
      expect(attribute.name.length, attribute.code).toBeLessThanOrEqual(120);
      if (attribute.legacyUnit) {
        expect(attribute.legacyUnit.length, attribute.code).toBeLessThanOrEqual(
          50,
        );
      }
      if (attribute.exampleValue) {
        expect(attribute.exampleValue.length, attribute.code).toBeLessThanOrEqual(
          300,
        );
      }
    }

    for (const value of data.allowedValues) {
      expect(value.code.length, value.attributeCode).toBeLessThanOrEqual(80);
      expect(value.label.length, value.attributeCode).toBeLessThanOrEqual(160);
    }
  });

  it('contains no demo records', () => {
    const serialized = JSON.stringify({
      data,
      vehicles: VEHICLE_LIBRARY,
    });
    expect(serialized).not.toContain('DEMO_');
    expect(serialized).not.toContain('(Demo)');
  });
});
