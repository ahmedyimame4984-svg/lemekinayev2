import type {
  VehicleConfigurationRecord,
  VehicleEngineRecord,
  VehicleGenerationRecord,
  VehicleMakeRecord,
  VehicleModelRecord,
  VehicleModelDerivativeRecord,
  VehicleTransmissionRecord,
  VehicleTrimRecord,
} from './vehicle-contracts';

export interface ConfiguredVehicleTrimGroup {
  trim: VehicleTrimRecord | null;
  configurations: VehicleConfigurationRecord[];
}

export interface ConfiguredVehicleGenerationGroup {
  generation: VehicleGenerationRecord | null;
  trims: ConfiguredVehicleTrimGroup[];
}

export interface ConfiguredVehicleDerivativeGroup {
  derivative: VehicleModelDerivativeRecord | null;
  generations: ConfiguredVehicleGenerationGroup[];
}

export interface ConfiguredVehicleModelGroup {
  model: VehicleModelRecord;
  derivatives: ConfiguredVehicleDerivativeGroup[];
}

export function configuredVehicleLibrary(
  configurations: VehicleConfigurationRecord[],
  models: VehicleModelRecord[],
  derivatives: VehicleModelDerivativeRecord[],
  generations: VehicleGenerationRecord[],
  trims: VehicleTrimRecord[],
  filters: {
    modelId?: string;
    derivativeId?: string;
    generationId?: string;
    trimId?: string;
  } = {},
): ConfiguredVehicleModelGroup[] {
  const modelById = new Map(models.map((model) => [model.id, model]));
  const derivativeById = new Map(
    derivatives.map((derivative) => [derivative.id, derivative]),
  );
  const generationById = new Map(
    generations.map((generation) => [generation.id, generation]),
  );
  const trimById = new Map(trims.map((trim) => [trim.id, trim]));

  const grouped = new Map<
    string,
    Map<
      string,
      Map<string, Map<string, VehicleConfigurationRecord[]>>
    >
  >();

  for (const configuration of configurations) {
    if (filters.modelId && configuration.modelId !== filters.modelId) continue;
    if (
      filters.generationId &&
      configuration.generationId !== filters.generationId
    ) {
      continue;
    }
    if (filters.trimId && configuration.trimId !== filters.trimId) continue;
    if (!modelById.has(configuration.modelId)) continue;

    const generation = configuration.generationId
      ? generationById.get(configuration.generationId) ?? null
      : null;
    const derivativeId = generation?.derivativeId ?? null;
    if (filters.derivativeId && derivativeId !== filters.derivativeId) continue;

    const derivativeKey = derivativeId ?? '__unspecified_derivative__';
    const generationKey =
      configuration.generationId ?? '__unspecified_generation__';
    const trimKey = configuration.trimId ?? '__unspecified_trim__';

    const byDerivative =
      grouped.get(configuration.modelId) ??
      new Map<
        string,
        Map<string, Map<string, VehicleConfigurationRecord[]>>
      >();
    const byGeneration =
      byDerivative.get(derivativeKey) ??
      new Map<string, Map<string, VehicleConfigurationRecord[]>>();
    const byTrim =
      byGeneration.get(generationKey) ??
      new Map<string, VehicleConfigurationRecord[]>();
    const records = byTrim.get(trimKey) ?? [];

    records.push(configuration);
    byTrim.set(trimKey, records);
    byGeneration.set(generationKey, byTrim);
    byDerivative.set(derivativeKey, byGeneration);
    grouped.set(configuration.modelId, byDerivative);
  }

  return [...grouped.entries()]
    .map(([modelId, byDerivative]) => {
      const model = modelById.get(modelId);
      if (!model) return null;

      const groupedDerivatives = [...byDerivative.entries()]
        .map(([derivativeId, byGeneration]) => {
          const derivative =
            derivativeId === '__unspecified_derivative__'
              ? null
              : derivativeById.get(derivativeId) ?? null;

          const groupedGenerations = [...byGeneration.entries()]
            .map(([generationId, byTrim]) => {
              const groupedTrims = [...byTrim.entries()]
                .map(([trimId, records]) => ({
                  trim:
                    trimId === '__unspecified_trim__'
                      ? null
                      : trimById.get(trimId) ?? null,
                  configurations: [...records].sort(
                    (a, b) =>
                      (a.modelYear ?? Number.MAX_SAFE_INTEGER) -
                        (b.modelYear ?? Number.MAX_SAFE_INTEGER) ||
                      a.identityCode.localeCompare(b.identityCode),
                  ),
                }))
                .sort((a, b) => {
                  if (!a.trim && b.trim) return 1;
                  if (a.trim && !b.trim) return -1;
                  if (!a.trim || !b.trim) return 0;
                  return a.trim.name.localeCompare(b.trim.name);
                });

              return {
                generation:
                  generationId === '__unspecified_generation__'
                    ? null
                    : generationById.get(generationId) ?? null,
                trims: groupedTrims,
              };
            })
            .sort((a, b) => {
              if (!a.generation && b.generation) return 1;
              if (a.generation && !b.generation) return -1;
              if (!a.generation || !b.generation) return 0;
              const aYear = a.generation.startYear ?? Number.MAX_SAFE_INTEGER;
              const bYear = b.generation.startYear ?? Number.MAX_SAFE_INTEGER;
              return (
                aYear - bYear ||
                a.generation.name.localeCompare(b.generation.name)
              );
            });

          return {
            derivative,
            generations: groupedGenerations,
          };
        })
        .sort((a, b) => {
          if (!a.derivative && b.derivative) return 1;
          if (a.derivative && !b.derivative) return -1;
          if (!a.derivative || !b.derivative) return 0;
          return a.derivative.name.localeCompare(b.derivative.name);
        });

      return {
        model,
        derivatives: groupedDerivatives,
      };
    })
    .filter((group): group is ConfiguredVehicleModelGroup => group !== null)
    .sort((a, b) => a.model.name.localeCompare(b.model.name));
}

export interface ConfiguredVehicleHierarchyTrimGroup {
  trim: VehicleTrimRecord | null;
  configurations: VehicleConfigurationRecord[];
}

export interface ConfiguredVehicleHierarchyGenerationGroup {
  generation: VehicleGenerationRecord | null;
  derivative: VehicleModelDerivativeRecord | null;
  trims: ConfiguredVehicleHierarchyTrimGroup[];
}

export interface ConfiguredVehicleHierarchyModelGroup {
  model: VehicleModelRecord;
  generations: ConfiguredVehicleHierarchyGenerationGroup[];
}

export interface ConfiguredVehicleHierarchyMakeGroup {
  make: VehicleMakeRecord;
  models: ConfiguredVehicleHierarchyModelGroup[];
}

export function configuredVehicleHierarchy(
  configurations: VehicleConfigurationRecord[],
  makes: VehicleMakeRecord[],
  models: VehicleModelRecord[],
  derivatives: VehicleModelDerivativeRecord[],
  generations: VehicleGenerationRecord[],
  trims: VehicleTrimRecord[],
  filters: {
    makeId?: string;
    modelId?: string;
    derivativeId?: string;
    generationId?: string;
    trimId?: string;
  } = {},
): ConfiguredVehicleHierarchyMakeGroup[] {
  const makeById = new Map(makes.map((make) => [make.id, make]));
  const modelById = new Map(models.map((model) => [model.id, model]));
  const derivativeById = new Map(
    derivatives.map((derivative) => [derivative.id, derivative]),
  );
  const generationById = new Map(
    generations.map((generation) => [generation.id, generation]),
  );
  const trimById = new Map(trims.map((trim) => [trim.id, trim]));

  const grouped = new Map<
    string,
    Map<string, Map<string, Map<string, VehicleConfigurationRecord[]>>>
  >();

  for (const configuration of configurations) {
    if (filters.makeId && configuration.makeId !== filters.makeId) continue;
    if (filters.modelId && configuration.modelId !== filters.modelId) continue;
    if (
      filters.generationId &&
      configuration.generationId !== filters.generationId
    ) {
      continue;
    }
    if (filters.trimId && configuration.trimId !== filters.trimId) continue;

    const make = makeById.get(configuration.makeId);
    const model = modelById.get(configuration.modelId);
    if (!make || !model || model.makeId !== make.id) continue;

    const generation = configuration.generationId
      ? generationById.get(configuration.generationId) ?? null
      : null;
    const derivativeId = generation?.derivativeId ?? null;
    if (filters.derivativeId && derivativeId !== filters.derivativeId) continue;

    const generationKey =
      configuration.generationId ?? '__unspecified_generation__';
    const trimKey = configuration.trimId ?? '__unspecified_trim__';

    const byModel =
      grouped.get(make.id) ??
      new Map<string, Map<string, Map<string, VehicleConfigurationRecord[]>>>();
    const byGeneration =
      byModel.get(model.id) ??
      new Map<string, Map<string, VehicleConfigurationRecord[]>>();
    const byTrim =
      byGeneration.get(generationKey) ??
      new Map<string, VehicleConfigurationRecord[]>();
    const records = byTrim.get(trimKey) ?? [];

    records.push(configuration);
    byTrim.set(trimKey, records);
    byGeneration.set(generationKey, byTrim);
    byModel.set(model.id, byGeneration);
    grouped.set(make.id, byModel);
  }

  return [...grouped.entries()]
    .map(([makeId, byModel]) => {
      const make = makeById.get(makeId);
      if (!make) return null;

      const groupedModels = [...byModel.entries()]
        .map(([modelId, byGeneration]) => {
          const model = modelById.get(modelId);
          if (!model) return null;

          const groupedGenerations = [...byGeneration.entries()]
            .map(([generationId, byTrim]) => {
              const generation =
                generationId === '__unspecified_generation__'
                  ? null
                  : generationById.get(generationId) ?? null;
              const derivative = generation?.derivativeId
                ? derivativeById.get(generation.derivativeId) ?? null
                : null;

              const groupedTrims = [...byTrim.entries()]
                .map(([trimId, records]) => ({
                  trim:
                    trimId === '__unspecified_trim__'
                      ? null
                      : trimById.get(trimId) ?? null,
                  configurations: [...records].sort(
                    (a, b) =>
                      (a.productionStartYear ?? a.modelYear ?? Number.MAX_SAFE_INTEGER) -
                        (b.productionStartYear ?? b.modelYear ?? Number.MAX_SAFE_INTEGER) ||
                      (a.productionStartMonth ?? 0) -
                        (b.productionStartMonth ?? 0) ||
                      a.identityCode.localeCompare(b.identityCode),
                  ),
                }))
                .sort((a, b) => {
                  if (!a.trim && b.trim) return 1;
                  if (a.trim && !b.trim) return -1;
                  if (!a.trim || !b.trim) return 0;
                  return a.trim.name.localeCompare(b.trim.name);
                });

              return {
                generation,
                derivative,
                trims: groupedTrims,
              };
            })
            .sort((a, b) => {
              if (!a.generation && b.generation) return 1;
              if (a.generation && !b.generation) return -1;
              if (!a.generation || !b.generation) return 0;
              const aYear = a.generation.startYear ?? Number.MAX_SAFE_INTEGER;
              const bYear = b.generation.startYear ?? Number.MAX_SAFE_INTEGER;
              return (
                aYear - bYear ||
                a.generation.name.localeCompare(b.generation.name)
              );
            });

          return {
            model,
            generations: groupedGenerations,
          };
        })
        .filter(
          (group): group is ConfiguredVehicleHierarchyModelGroup =>
            group !== null,
        )
        .sort((a, b) => a.model.name.localeCompare(b.model.name));

      return {
        make,
        models: groupedModels,
      };
    })
    .filter(
      (group): group is ConfiguredVehicleHierarchyMakeGroup => group !== null,
    )
    .sort((a, b) => a.make.name.localeCompare(b.make.name));
}

export function configurationApplicabilityLabel(
  configuration: VehicleConfigurationRecord,
): string {
  const point = (year: number, month: number | null) =>
    month === null ? `${year}` : `${String(month).padStart(2, '0')}/${year}`;

  const start =
    configuration.productionStartYear === null
      ? null
      : point(
          configuration.productionStartYear,
          configuration.productionStartMonth,
        );
  const end =
    configuration.productionEndYear === null
      ? null
      : point(
          configuration.productionEndYear,
          configuration.productionEndMonth,
        );

  let production = 'Production period not verified';
  if (start && configuration.productionEndStatus === 'CURRENT') {
    production = `Production ${start}–present`;
  } else if (start && configuration.productionEndStatus === 'UNKNOWN') {
    production = `Production from ${start} · end not verified`;
  } else if (start && end) {
    production =
      start === end ? `Production ${start}` : `Production ${start}–${end}`;
  } else if (end) {
    production = `Production through ${end}`;
  }

  return configuration.modelYear === null
    ? production
    : `${production} · Model year ${configuration.modelYear}`;
}

export function engineTechnicalLabel(
  engine: VehicleEngineRecord | null | undefined,
): string {
  if (!engine) return 'Engine not specified';

  const parts = [
    engine.fuelType,
    engine.displacementCc ? `${engine.displacementCc} cc` : null,
    engine.cylinderCount ? `${engine.cylinderCount} cyl` : null,
    engine.aspiration,
    engine.powerKw ? `${engine.powerKw} kW` : null,
    engine.torqueNm ? `${engine.torqueNm} Nm` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(' · ') || 'Engine';
}

export function transmissionTechnicalLabel(
  transmission: VehicleTransmissionRecord | null | undefined,
): string {
  if (!transmission) return 'Transmission not specified';

  return [
    transmission.transmissionType,
    transmission.gearCount ? `${transmission.gearCount}-speed` : null,
    transmission.driveType,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
}

export function generationsForModel(
  generations: VehicleGenerationRecord[],
  modelId: string,
): VehicleGenerationRecord[] {
  return [...generations]
    .filter((item) => item.modelId === modelId)
    .sort((a, b) => {
      const aYear = a.startYear ?? Number.MAX_SAFE_INTEGER;
      const bYear = b.startYear ?? Number.MAX_SAFE_INTEGER;
      return aYear - bYear || a.name.localeCompare(b.name);
    });
}

export function trimsForGeneration(
  trims: VehicleTrimRecord[],
  generationId: string,
): VehicleTrimRecord[] {
  return [...trims]
    .filter((item) => item.generationId === generationId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type VehicleTechnicalSelection = {
  engines: VehicleEngineRecord[];
  transmissions: VehicleTransmissionRecord[];
  bodyTypeIds: string[];
  marketIds: string[];
  steeringSides: string[];
  relatedConfigurationCount: number;
};

export function technicalMastersForSelection(
  configurations: VehicleConfigurationRecord[],
  models: VehicleModelRecord[],
  generations: VehicleGenerationRecord[],
  trims: VehicleTrimRecord[],
  engines: VehicleEngineRecord[],
  transmissions: VehicleTransmissionRecord[],
  selection: {
    modelId: string;
    generationId?: string;
    trimId?: string;
  },
): VehicleTechnicalSelection {
  const selectedModel = models.find((item) => item.id === selection.modelId);
  if (!selectedModel) {
    return {
      engines: [],
      transmissions: [],
      bodyTypeIds: [],
      marketIds: [],
      steeringSides: [],
      relatedConfigurationCount: 0,
    };
  }

  const selectedGeneration = selection.generationId
    ? generations.find((item) => item.id === selection.generationId) ?? null
    : null;
  const selectedTrim = selection.trimId
    ? trims.find((item) => item.id === selection.trimId) ?? null
    : null;

  const related = configurations.filter((item) => {
    if (item.modelId !== selection.modelId) return false;
    if (selection.generationId && item.generationId !== selection.generationId) {
      return false;
    }
    if (selection.trimId && item.trimId !== selection.trimId) return false;
    return true;
  });

  const sameMakeModelIds = new Set(
    models
      .filter((item) => item.makeId === selectedModel.makeId)
      .map((item) => item.id),
  );
  const sameMakeConfigurations = configurations.filter((item) =>
    sameMakeModelIds.has(item.modelId),
  );

  const relatedEngineIds = new Set(
    related
      .map((item) => item.engineId)
      .filter((id): id is string => Boolean(id)),
  );
  const relatedTransmissionIds = new Set(
    related
      .map((item) => item.transmissionId)
      .filter((id): id is string => Boolean(id)),
  );
  const makeEngineIds = new Set(
    sameMakeConfigurations
      .map((item) => item.engineId)
      .filter((id): id is string => Boolean(id)),
  );
  const makeTransmissionIds = new Set(
    sameMakeConfigurations
      .map((item) => item.transmissionId)
      .filter((id): id is string => Boolean(id)),
  );

  const rangeStart =
    selectedTrim?.startYear ?? selectedGeneration?.startYear ?? null;
  const rangeEnd =
    selectedTrim?.endYear ?? selectedGeneration?.endYear ?? null;

  const overlaps = (
    startYear: number | null,
    endYear: number | null,
  ): boolean => {
    if (rangeStart !== null && endYear !== null && endYear < rangeStart) {
      return false;
    }
    if (rangeEnd !== null && startYear !== null && startYear > rangeEnd) {
      return false;
    }
    return true;
  };

  const sortRelevantFirst = <T extends { id: string }>(
    items: T[],
    relatedIds: Set<string>,
    makeIds: Set<string>,
  ) =>
    [...items].sort((a, b) => {
      const relatedDelta =
        Number(relatedIds.has(b.id)) - Number(relatedIds.has(a.id));
      const makeDelta = Number(makeIds.has(b.id)) - Number(makeIds.has(a.id));
      return relatedDelta || makeDelta || a.id.localeCompare(b.id);
    });

  const engineOptions = engines.filter((item) =>
    overlaps(item.startYear, item.endYear),
  );

  const transmissionOptions = transmissions.filter((item) =>
    overlaps(item.startYear, item.endYear),
  );

  const unique = (values: Array<string | null>) => [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];

  return {
    engines: sortRelevantFirst(
      engineOptions,
      relatedEngineIds,
      makeEngineIds,
    ),
    transmissions: sortRelevantFirst(
      transmissionOptions,
      relatedTransmissionIds,
      makeTransmissionIds,
    ),
    bodyTypeIds: unique(related.map((item) => item.bodyTypeId)),
    marketIds: unique(related.map((item) => item.marketId)),
    steeringSides: unique(related.map((item) => item.steeringSide)),
    relatedConfigurationCount: related.length,
  };
}

export function configurationYearBounds(
  generation: VehicleGenerationRecord | null | undefined,
  trim: VehicleTrimRecord | null | undefined,
): { min: number; max: number | null } | null {
  if (!generation) return null;

  const min = Math.max(
    generation.startYear ?? 1886,
    trim?.startYear ?? generation.startYear ?? 1886,
  );

  const finiteEnds = [generation.endYear, trim?.endYear]
    .filter((value): value is number => value !== null && value !== undefined);
  const max = finiteEnds.length > 0 ? Math.min(...finiteEnds) : null;

  return { min, max };
}

export function createVehicleConfigurationCode(parts: string[]): string {
  const body = parts
    .map((part) =>
      part
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/gu, '_')
        .replace(/^_+|_+$/gu, ''),
    )
    .filter(Boolean)
    .join('_')
    .replace(/_+/gu, '_');

  const prefixed = body.startsWith('VEH_') ? body : `VEH_${body}`;
  return prefixed.slice(0, 80).replace(/_+$/gu, '');
}
