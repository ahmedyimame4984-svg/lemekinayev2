import { describe, expect, it } from 'vitest';
import {
  evaluatePowertrain,
  normalizePowertrainAssignments,
  type PowertrainAssignment,
  type PowertrainFacts,
  type PowertrainType,
} from './vehicle-powertrain-policy.js';

const machine = (
  roles: PowertrainAssignment['functionRoles'] = ['TRACTION'],
): PowertrainAssignment => ({
  componentId: 'motor',
  position: 'UNKNOWN',
  functionRoles: roles,
  quantity: 1,
});
function facts(type: PowertrainType): PowertrainFacts {
  const f: PowertrainFacts = {
    powertrainType: type,
    propulsionTopology: 'PARALLEL',
    engineId: 'engine',
    engineRole: 'MECHANICAL_PROPULSION',
    transmissionId: 'transmission',
    batteryPackId: 'store',
    storageKind: 'BATTERY',
    energyStorageRole: 'PROPULSION',
    chargingSystemId: null,
    externalChargingCapability: 'NONE',
    electricMotors: [machine()],
    driveUnits: [],
  };
  if (type === 'ICE')
    Object.assign(f, {
      propulsionTopology: 'ICE_MECHANICAL',
      batteryPackId: null,
      storageKind: null,
      energyStorageRole: null,
      electricMotors: [],
    });
  if (type === 'BEV')
    Object.assign(f, {
      propulsionTopology: 'ELECTRIC_ONLY',
      engineId: null,
      engineRole: null,
      transmissionId: null,
      externalChargingCapability: 'PLUG_IN',
    });
  if (type === 'PHEV') f.externalChargingCapability = 'PLUG_IN';
  if (type === 'MHEV')
    Object.assign(f, {
      energyStorageRole: 'HYBRID_SUPPORT',
      electricMotors: [machine(['ENGINE_START', 'GENERATION'])],
    });
  if (type === 'EREV')
    Object.assign(f, {
      propulsionTopology: 'SERIES',
      engineRole: 'GENERATOR_ONLY',
      transmissionId: null,
      externalChargingCapability: 'PLUG_IN',
    });
  return f;
}

describe('EV technical policy', () => {
  it.each<PowertrainType>(['ICE', 'MHEV'])(
    'rejects generator-only %s even when topology is missing',
    (type) => {
      expect(
        evaluatePowertrain({
          ...facts(type),
          propulsionTopology: null,
          engineRole: 'GENERATOR_ONLY',
        }).contradictions.some((issue) => issue.field === 'engineRole'),
      ).toBe(true);
    },
  );
  it.each<PowertrainType>(['ICE', 'BEV', 'HEV', 'PHEV', 'MHEV', 'EREV'])(
    'accepts complete %s technical facts without claiming evidence or identity validation',
    (type) => {
      expect(evaluatePowertrain(facts(type))).toEqual({
        missing: [],
        contradictions: [],
      });
    },
  );
  it('keeps unknown classification and charging capability distinct from ICE and NONE', () => {
    const f = {
      ...facts('BEV'),
      powertrainType: null,
      externalChargingCapability: null,
    };
    expect(evaluatePowertrain(f).missing.map((i) => i.field)).toEqual(
      expect.arrayContaining(['powertrainType', 'externalChargingCapability']),
    );
    expect(f.powertrainType).toBeNull();
  });
  it('accepts Nissan-style series HEV without plug or engine-to-wheel gearbox', () => {
    expect(
      evaluatePowertrain({
        ...facts('HEV'),
        propulsionTopology: 'SERIES',
        engineRole: 'GENERATOR_ONLY',
        transmissionId: null,
      }),
    ).toEqual({ missing: [], contradictions: [] });
  });
  it('accepts an integrated BEV eAxle without duplicate motor/reducer rows', () => {
    expect(
      evaluatePowertrain({
        ...facts('BEV'),
        electricMotors: [],
        driveUnits: [{ ...machine(), integrationKind: 'INTEGRATED_E_DRIVE' }],
      }),
    ).toEqual({ missing: [], contradictions: [] });
  });
  it('accepts an integrated power-split transaxle', () => {
    expect(
      evaluatePowertrain({
        ...facts('HEV'),
        propulsionTopology: 'POWER_SPLIT',
        engineRole: 'PROPULSION_AND_GENERATION',
        transmissionId: null,
        electricMotors: [],
        driveUnits: [
          { ...machine(), integrationKind: 'INTEGRATED_HYBRID_TRANSMISSION' },
        ],
      }),
    ).toEqual({ missing: [], contradictions: [] });
  });
  it('accepts MHEV supercapacitor storage and integrated assist without traction claims', () => {
    expect(
      evaluatePowertrain({
        ...facts('MHEV'),
        storageKind: 'SUPERCAPACITOR',
        electricMotors: [],
        driveUnits: [
          {
            ...machine(['PROPULSION_ASSIST']),
            integrationKind: 'INTEGRATED_HYBRID_MACHINE',
          },
        ],
      }),
    ).toEqual({ missing: [], contradictions: [] });
  });
  it('does not infer transmission inclusion from an integrated hybrid machine', () => {
    expect(
      evaluatePowertrain({
        ...facts('MHEV'),
        transmissionId: null,
        driveUnits: [
          {
            ...machine(['PROPULSION_ASSIST']),
            integrationKind: 'INTEGRATED_HYBRID_MACHINE',
          },
        ],
      }).missing.some((i) => i.field === 'transmissionId'),
    ).toBe(true);
  });
  it('accepts a real BEV gearbox', () => {
    expect(
      evaluatePowertrain({ ...facts('BEV'), transmissionId: 'two-speed' })
        .contradictions,
    ).toEqual([]);
  });
  it('accepts swap-only BEV with no charger identity', () => {
    expect(
      evaluatePowertrain({
        ...facts('BEV'),
        externalChargingCapability: 'BATTERY_SWAP',
      }),
    ).toEqual({ missing: [], contradictions: [] });
  });
  it.each<PowertrainType>(['PHEV', 'EREV'])('rejects swap-only %s', (type) => {
    expect(
      evaluatePowertrain({
        ...facts(type),
        externalChargingCapability: 'BATTERY_SWAP',
      }).contradictions.some((i) => i.field === 'externalChargingCapability'),
    ).toBe(true);
  });
  it('rejects combustion associations on BEV even for Draft consistency', () => {
    expect(
      evaluatePowertrain({
        ...facts('BEV'),
        engineId: 'engine',
      }).contradictions.some((i) => i.field === 'engineId'),
    ).toBe(true);
  });
  it('does not let a machine-free reducer satisfy traction readiness', () => {
    const result = evaluatePowertrain({
      ...facts('BEV'),
      electricMotors: [],
      driveUnits: [{ ...machine(), integrationKind: 'REDUCTION_ONLY' }],
    });
    expect(
      result.missing.some((i) =>
        i.code.endsWith('ELECTRIC_PROPULSION_REQUIRED'),
      ),
    ).toBe(true);
    expect(
      result.contradictions.some(
        (i) => i.field === 'driveUnits[0].functionRoles',
      ),
    ).toBe(true);
  });
  it('rejects duplicate roles and fractional/zero quantities', () => {
    const r = evaluatePowertrain({
      ...facts('BEV'),
      electricMotors: [{ ...machine(['TRACTION', 'TRACTION']), quantity: 0.5 }],
    });
    expect(r.contradictions.map((i) => i.field)).toEqual(
      expect.arrayContaining([
        'electricMotors[0].quantity',
        'electricMotors[0].functionRoles',
      ]),
    );
  });
  it('keeps missing machine roles as readiness, rather than inventing traction', () => {
    expect(
      evaluatePowertrain({
        ...facts('BEV'),
        electricMotors: [machine([])],
      }).missing.some((i) => i.code.endsWith('ELECTRIC_PROPULSION_REQUIRED')),
    ).toBe(true);
  });
  it('normalizes order without changing quantity, function or position', () => {
    const a = {
      ...machine(['GENERATION', 'TRACTION']),
      componentId: 'a',
      quantity: 2,
    };
    const b = { ...machine(), componentId: 'b', position: 'REAR' };
    expect(normalizePowertrainAssignments([b, a])).toEqual(
      normalizePowertrainAssignments([
        { ...a, functionRoles: ['TRACTION', 'GENERATION'] },
        b,
      ]),
    );
    expect(a.functionRoles).toEqual(['GENERATION', 'TRACTION']);
  });
  it('rejects duplicate assignment identities rather than weakening Stage 1 uniqueness', () => {
    expect(
      evaluatePowertrain({
        ...facts('BEV'),
        electricMotors: [machine(), machine()],
      }).contradictions.some((i) => i.code.endsWith('COMPONENT_AMBIGUOUS')),
    ).toBe(true);
  });
  it('allows repeated identical assemblies through quantity', () => {
    expect(
      evaluatePowertrain({
        ...facts('BEV'),
        electricMotors: [{ ...machine(), quantity: 2 }],
      }),
    ).toEqual({ missing: [], contradictions: [] });
  });

  it.each([
    { label: 'zero', quantity: 0 },
    { label: 'negative', quantity: -1 },
    { label: 'fractional', quantity: 1.5 },
    { label: 'beyond int4', quantity: 2_147_483_648 },
    { label: 'safe but beyond int4', quantity: Number.MAX_SAFE_INTEGER },
    { label: 'infinite', quantity: Number.POSITIVE_INFINITY },
    { label: 'NaN', quantity: Number.NaN },
  ])('rejects $label quantity outside PostgreSQL INTEGER', ({ quantity }) => {
    const r = evaluatePowertrain({
      ...facts('BEV'),
      electricMotors: [{ ...machine(), quantity }],
    });
    expect(r.contradictions.map((i) => i.field)).toContain(
      'electricMotors[0].quantity',
    );
  });

  it.each([1, 2_147_483_647])(
    'accepts positive quantity %i at PostgreSQL boundaries',
    (quantity) => {
      expect(
        evaluatePowertrain({
          ...facts('BEV'),
          electricMotors: [{ ...machine(), quantity }],
        }),
      ).toEqual({ missing: [], contradictions: [] });
    },
  );

  it.each([
    { type: 'ICE', topology: 'PARALLEL' },
    { type: 'BEV', topology: 'SERIES' },
    { type: 'HEV', topology: 'ELECTRIC_ONLY' },
    { type: 'PHEV', topology: 'ICE_MECHANICAL' },
    { type: 'MHEV', topology: 'SERIES' },
    { type: 'EREV', topology: 'PARALLEL' },
  ] as const)(
    'rejects $type with contradictory $topology topology',
    ({ type, topology }) => {
      const r = evaluatePowertrain({
        ...facts(type),
        propulsionTopology: topology,
      });
      expect(r.contradictions.map((i) => i.field)).toContain(
        'propulsionTopology',
      );
    },
  );

  it.each([
    { type: 'ICE', capability: 'PLUG_IN' },
    { type: 'BEV', capability: 'NONE' },
    { type: 'HEV', capability: 'BATTERY_SWAP' },
    { type: 'PHEV', capability: 'BATTERY_SWAP' },
    { type: 'MHEV', capability: 'PLUG_IN_AND_SWAP' },
    { type: 'EREV', capability: 'NONE' },
  ] as const)(
    'rejects $type with contradictory $capability charging',
    ({ type, capability }) => {
      const r = evaluatePowertrain({
        ...facts(type),
        externalChargingCapability: capability,
      });
      expect(r.contradictions.map((i) => i.field)).toContain(
        'externalChargingCapability',
      );
    },
  );

  it.each([
    { type: 'ICE', topology: 'ICE_MECHANICAL', engineRole: 'GENERATOR_ONLY' },
    { type: 'HEV', topology: 'SERIES', engineRole: 'MECHANICAL_PROPULSION' },
    { type: 'PHEV', topology: 'POWER_SPLIT', engineRole: 'GENERATOR_ONLY' },
    { type: 'MHEV', topology: 'PARALLEL', engineRole: 'GENERATOR_ONLY' },
    { type: 'EREV', topology: 'SERIES', engineRole: 'PROPULSION_AND_GENERATION' },
  ] as const)(
    'rejects $type with mismatched engine function on $topology',
    ({ type, topology, engineRole }) => {
      const r = evaluatePowertrain({
        ...facts(type),
        propulsionTopology: topology,
        engineRole,
      });
      expect(r.contradictions.map((i) => i.field)).toContain('engineRole');
    },
  );

  it.each([
    { type: 'BEV', role: 'HYBRID_SUPPORT' },
    { type: 'HEV', role: 'HYBRID_SUPPORT' },
    { type: 'PHEV', role: 'HYBRID_SUPPORT' },
    { type: 'MHEV', role: 'PROPULSION' },
    { type: 'EREV', role: 'HYBRID_SUPPORT' },
  ] as const)(
    'rejects $type with incompatible $role storage role',
    ({ type, role }) => {
      const r = evaluatePowertrain({
        ...facts(type),
        energyStorageRole: role,
      });
      expect(r.contradictions.map((i) => i.field)).toContain(
        'energyStorageRole',
      );
    },
  );

  it.each(['BEV', 'PHEV', 'EREV'] as const)(
    'rejects supercapacitor-only propulsion storage for %s',
    (type) => {
      const r = evaluatePowertrain({
        ...facts(type),
        storageKind: 'SUPERCAPACITOR',
      });
      expect(r.contradictions.map((i) => i.field)).toContain('batteryPackId');
    },
  );

  it.each(['ICE', 'BEV', 'HEV', 'PHEV', 'MHEV', 'EREV'] as const)(
    'reports incomplete %s Draft without treating absence as a contradiction',
    (type) => {
      const initial = facts(type);
      const r = evaluatePowertrain({
        ...initial,
        engineId: type === 'ICE' ? null : initial.engineId,
        engineRole: type === 'ICE' ? null : initial.engineRole,
        transmissionId: type === 'ICE' ? null : initial.transmissionId,
        batteryPackId: null,
        storageKind: null,
        energyStorageRole: null,
      });
      expect(r.missing.length).toBeGreaterThan(0);
      expect(r.contradictions).toEqual([]);
    },
  );

  it.each([
    'powertrainType',
    'propulsionTopology',
    'externalChargingCapability',
  ] as const)(
    'requires missing common readiness field %s',
    (field) => {
      const r = evaluatePowertrain({
        ...facts('BEV'),
        [field]: null,
      });
      expect(r.missing.map((i) => i.field)).toContain(field);
    },
  );

  it('does not infer traction from an unclassified integrated drive assembly', () => {
    const r = evaluatePowertrain({
      ...facts('BEV'),
      electricMotors: [],
      driveUnits: [{ ...machine(['TRACTION']), integrationKind: null }],
    });
    expect(r.missing.map((i) => i.field)).toContain(
      'driveUnits[0].integrationKind',
    );
    expect(r.missing.some((i) =>
      i.code.endsWith('ELECTRIC_PROPULSION_REQUIRED'),
    )).toBe(true);
  });

  it('does not infer a machine from an integrated transmission with no machine functions', () => {
    const r = evaluatePowertrain({
      ...facts('HEV'),
      electricMotors: [],
      transmissionId: null,
      driveUnits: [
        { ...machine([]), integrationKind: 'INTEGRATED_HYBRID_TRANSMISSION' },
      ],
    });
    expect(r.missing.some((i) =>
      i.code.endsWith('ELECTRIC_PROPULSION_REQUIRED'),
    )).toBe(true);
    expect(r.missing.map((i) => i.field)).not.toContain('transmissionId');
  });
});
