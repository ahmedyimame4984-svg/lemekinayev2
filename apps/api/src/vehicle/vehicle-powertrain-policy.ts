/** Pure technical policy. Reference, provenance, identity and lifecycle checks stay transactional. */
import type {
  VehiclePowertrainType,
  VehiclePropulsionTopology,
  VehicleCombustionEngineRole,
  VehicleElectricMachineFunction,
  VehicleDriveUnitIntegrationKind,
  VehicleExternalChargingCapability,
} from '@prisma/client';
export type PowertrainType = `${VehiclePowertrainType}`;
export type PropulsionTopology = `${VehiclePropulsionTopology}`;
export type EngineRole = `${VehicleCombustionEngineRole}`;
export type MachineFunction = `${VehicleElectricMachineFunction}`;
export type IntegrationKind = `${VehicleDriveUnitIntegrationKind}`;
export type ChargingCapability = `${VehicleExternalChargingCapability}`;

export interface PowertrainAssignment {
  componentId: string;
  position: string;
  functionRoles: readonly MachineFunction[];
  quantity: number;
  integrationKind?: IntegrationKind | null;
}

export interface PowertrainFacts {
  powertrainType: PowertrainType | null;
  propulsionTopology: PropulsionTopology | null;
  engineId: string | null;
  engineRole: EngineRole | null;
  transmissionId: string | null;
  batteryPackId: string | null;
  storageKind: 'BATTERY' | 'SUPERCAPACITOR' | null;
  energyStorageRole: 'PROPULSION' | 'HYBRID_SUPPORT' | null;
  chargingSystemId: string | null;
  externalChargingCapability: ChargingCapability | null;
  electricMotors: readonly PowertrainAssignment[];
  driveUnits: readonly PowertrainAssignment[];
}

export interface PowertrainIssue {
  code: string;
  field: string;
  message: string;
}

const hybridTopologies: readonly PropulsionTopology[] = [
  'SERIES',
  'PARALLEL',
  'POWER_SPLIT',
  'SERIES_PARALLEL',
];
const allowedTopologies: Record<PowertrainType, readonly PropulsionTopology[]> =
  {
    ICE: ['ICE_MECHANICAL'],
    BEV: ['ELECTRIC_ONLY'],
    HEV: hybridTopologies,
    PHEV: hybridTopologies,
    MHEV: ['PARALLEL'],
    EREV: ['SERIES', 'SERIES_PARALLEL', 'POWER_SPLIT'],
  };
const topologyRoles: Partial<
  Record<PropulsionTopology, readonly EngineRole[]>
> = {
  ICE_MECHANICAL: ['MECHANICAL_PROPULSION'],
  SERIES: ['GENERATOR_ONLY'],
  PARALLEL: ['MECHANICAL_PROPULSION', 'PROPULSION_AND_GENERATION'],
  POWER_SPLIT: ['PROPULSION_AND_GENERATION'],
  SERIES_PARALLEL: ['PROPULSION_AND_GENERATION'],
};

export function normalizePowertrainAssignments(
  assignments: readonly PowertrainAssignment[],
): PowertrainAssignment[] {
  return assignments
    .map((a) => ({ ...a, functionRoles: [...a.functionRoles].sort() }))
    .sort(
      (a, b) =>
        a.componentId.localeCompare(b.componentId) ||
        a.position.localeCompare(b.position),
    );
}

/** Missing facts are readiness issues; contradictory supplied facts reject Drafts too. */
export function evaluatePowertrain(facts: PowertrainFacts): {
  missing: PowertrainIssue[];
  contradictions: PowertrainIssue[];
} {
  const missing: PowertrainIssue[] = [];
  const contradictions: PowertrainIssue[] = [];
  const issue = (
    target: PowertrainIssue[],
    suffix: string,
    field: string,
    message: string,
  ) => {
    target.push({ code: `VEHICLE_CONFIGURATION_${suffix}`, field, message });
  };
  const need = (
    condition: unknown,
    suffix: string,
    field: string,
    message: string,
  ) => {
    if (!condition) issue(missing, suffix, field, message);
  };
  const reject = (
    condition: unknown,
    suffix: string,
    field: string,
    message: string,
  ) => {
    if (condition) issue(contradictions, suffix, field, message);
  };
  for (const [field, assignments] of [
    ['electricMotors', facts.electricMotors],
    ['driveUnits', facts.driveUnits],
  ] as const) {
    const identities = new Set<string>();
    assignments.forEach((a, index) => {
      const path = `${field}[${index}]`;
      reject(
        !Number.isSafeInteger(a.quantity) || a.quantity < 1 || a.quantity > 2_147_483_647,
        'COMPONENT_QUANTITY_INVALID',
        `${path}.quantity`,
        'Quantity must be a whole number from 1 to 2,147,483,647 (PostgreSQL INTEGER).',
      );
      reject(
        new Set(a.functionRoles).size !== a.functionRoles.length,
        'COMPONENT_ROLES_INVALID',
        `${path}.functionRoles`,
        'Machine functions must be distinct.',
      );
      const key = JSON.stringify([a.componentId, a.position]);
      reject(
        identities.has(key),
        'COMPONENT_AMBIGUOUS',
        path,
        'Use quantity for identical assemblies at the same position.',
      );
      identities.add(key);
      if (field === 'driveUnits') {
        reject(
          a.integrationKind === 'REDUCTION_ONLY' && a.functionRoles.length > 0,
          'COMPONENT_ROLES_INVALID',
          `${path}.functionRoles`,
          'A machine-free reducer cannot have machine functions.',
        );
        need(
          a.integrationKind,
          'ELECTRIC_PROPULSION_REQUIRED',
          `${path}.integrationKind`,
          'Verify the drive-unit integration kind.',
        );
      }
    });
  }
  reject(
    facts.engineRole && !facts.engineId,
    'ENGINE_ROLE_MISMATCH',
    'engineRole',
    'An engine role requires an Engine association.',
  );
  reject(
    facts.energyStorageRole && !facts.batteryPackId,
    'ENERGY_STORAGE_MISMATCH',
    'energyStorageRole',
    'A storage role requires an energy-store association.',
  );
  reject(
    facts.storageKind && !facts.batteryPackId,
    'ENERGY_STORAGE_MISMATCH',
    'batteryPackId',
    'A storage kind requires an energy-store association.',
  );
  const type = facts.powertrainType;
  need(
    type,
    'POWERTRAIN_REQUIRED',
    'powertrainType',
    'Verify the powertrain classification.',
  );
  need(
    facts.propulsionTopology,
    'TOPOLOGY_REQUIRED',
    'propulsionTopology',
    'Verify the propulsion topology.',
  );
  need(
    facts.externalChargingCapability,
    'CHARGING_CAPABILITY_REQUIRED',
    'externalChargingCapability',
    'Verify external charging capability, including NONE.',
  );
  if (facts.propulsionTopology === 'ELECTRIC_ONLY') {
    reject(
      facts.engineId || facts.engineRole,
      'ENGINE_ROLE_MISMATCH',
      'engineId',
      'Electric-only propulsion cannot have a combustion engine.',
    );
  } else if (facts.propulsionTopology && facts.engineRole) {
    reject(
      !topologyRoles[facts.propulsionTopology]?.includes(facts.engineRole),
      'ENGINE_ROLE_MISMATCH',
      'engineRole',
      'Engine role contradicts the propulsion topology.',
    );
  }
  reject(
    facts.chargingSystemId &&
      ['NONE', 'BATTERY_SWAP'].includes(facts.externalChargingCapability ?? ''),
    'CHARGING_MISMATCH',
    'chargingSystemId',
    'A traction charger association requires plug-in capability.',
  );
  if (!type) return { missing, contradictions };
  if (facts.engineRole && type !== 'BEV') {
    reject(
      !allowedTopologies[type].some((topology) =>
        topologyRoles[topology]?.includes(facts.engineRole!),
      ),
      'ENGINE_ROLE_MISMATCH',
      'engineRole',
      'Engine role contradicts every topology supported by this class.',
    );
  }
  reject(
    facts.propulsionTopology &&
      !allowedTopologies[type].includes(facts.propulsionTopology),
    'TOPOLOGY_MISMATCH',
    'propulsionTopology',
    'Topology contradicts the selected powertrain class.',
  );
  const machines = [
    ...facts.electricMotors,
    ...facts.driveUnits.filter(
      (a) => a.integrationKind && a.integrationKind !== 'REDUCTION_ONLY',
    ),
  ];
  const traction = machines.some((a) => a.functionRoles.includes('TRACTION'));
  const hybridMachine = machines.some(
    (a) =>
      a.functionRoles.includes('PROPULSION_ASSIST') ||
      (a.functionRoles.includes('ENGINE_START') &&
        a.functionRoles.includes('GENERATION')),
  );
  const integratedTransmission = facts.driveUnits.some(
    (a) => a.integrationKind === 'INTEGRATED_HYBRID_TRANSMISSION',
  );
  if (type === 'ICE') {
    reject(
      facts.electricMotors.length ||
        facts.driveUnits.length ||
        facts.batteryPackId ||
        facts.chargingSystemId,
      'TOPOLOGY_MISMATCH',
      'powertrainType',
      'ICE cannot carry EV machine, drive, storage or traction charger associations.',
    );
  }
  if (type === 'BEV') {
    reject(
      facts.engineId || facts.engineRole,
      'ENGINE_ROLE_MISMATCH',
      'engineId',
      'BEV cannot have a combustion engine or engine role.',
    );
  } else {
    need(
      facts.engineId,
      'ENGINE_REQUIRED',
      'engineId',
      'Select the verified combustion engine.',
    );
    need(
      facts.engineRole,
      'ENGINE_ROLE_REQUIRED',
      'engineRole',
      'Verify the configuration-specific engine role.',
    );
  }
  const mechanicalPath = [
    'ICE_MECHANICAL',
    'PARALLEL',
    'POWER_SPLIT',
    'SERIES_PARALLEL',
  ].includes(facts.propulsionTopology ?? '');
  if (mechanicalPath && type !== 'BEV') {
    need(
      facts.transmissionId || integratedTransmission,
      'TRANSMISSION_REQUIRED',
      'transmissionId',
      'Verify the mechanical transmission path, separately or in an integrated hybrid transmission.',
    );
  }
  if (type === 'MHEV')
    need(
      hybridMachine,
      'HYBRID_MACHINE_REQUIRED',
      'electricMotors',
      'Verify starter-generator or propulsion-assist machine functions.',
    );
  else if (type !== 'ICE')
    need(
      traction,
      'ELECTRIC_PROPULSION_REQUIRED',
      'electricMotors',
      'Verify a traction machine or integrated electric propulsion assembly.',
    );
  if (type !== 'ICE') {
    need(
      facts.batteryPackId,
      'ENERGY_STORAGE_REQUIRED',
      'batteryPackId',
      'Select the actual propulsion or hybrid-system energy store.',
    );
    need(
      facts.storageKind,
      'ENERGY_STORAGE_REQUIRED',
      'batteryPackId',
      'Verify energy-storage technology.',
    );
    need(
      facts.energyStorageRole,
      'ENERGY_STORAGE_REQUIRED',
      'energyStorageRole',
      'Verify the energy-store role.',
    );
    const role = type === 'MHEV' ? 'HYBRID_SUPPORT' : 'PROPULSION';
    reject(
      facts.energyStorageRole && facts.energyStorageRole !== role,
      'ENERGY_STORAGE_MISMATCH',
      'energyStorageRole',
      `This class requires ${role} storage.`,
    );
    reject(
      ['BEV', 'PHEV', 'EREV'].includes(type) &&
        facts.storageKind &&
        facts.storageKind !== 'BATTERY',
      'ENERGY_STORAGE_MISMATCH',
      'batteryPackId',
      'This class requires a rechargeable propulsion battery.',
    );
  }
  const capability = facts.externalChargingCapability;
  if (['ICE', 'HEV', 'MHEV'].includes(type)) {
    reject(
      capability && capability !== 'NONE',
      'CHARGING_MISMATCH',
      'externalChargingCapability',
      'This non-plug-in class requires NONE.',
    );
    reject(
      facts.chargingSystemId,
      'CHARGING_MISMATCH',
      'chargingSystemId',
      'This non-plug-in class cannot carry a traction charger.',
    );
  } else {
    reject(
      capability === 'NONE' ||
        (type !== 'BEV' && capability === 'BATTERY_SWAP'),
      'CHARGING_MISMATCH',
      'externalChargingCapability',
      'Verify a supported external charging capability for this class.',
    );
  }
  return { missing, contradictions };
}
