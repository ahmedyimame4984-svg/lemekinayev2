import { config as loadEnvironment } from 'dotenv';
import { Prisma } from '@prisma/client';
import { parseArgs } from 'node:util';
import { DatabaseService } from '../database/database.service.js';
import { VEHICLE_LIBRARY } from './africa-vehicle-library.js';
import { classifyVehicleReconstructionRecord } from '../vehicle/vehicle-reconstruction-audit.js';
import { VEHICLE_DATA_STANDARD } from '../vehicle/vehicle-reconstruction-standard.js';

loadEnvironment({ quiet: true });

const { values } = parseArgs({
  options: { 'page-size': { type: 'string', default: '250' } },
  strict: true,
});
const pageSize = Number(values['page-size']);
if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000)
  throw new Error('page-size must be 1–1000');
// No AppModule: invoking the audit must not trigger application bootstrap writes.
const db = new DatabaseService();
const legacyCodes = new Set(
  VEHICLE_LIBRARY.flatMap((make) =>
    make.models.flatMap((model) =>
      model.generations.flatMap((generation) =>
        generation.trims.flatMap((trim) =>
          trim.configurations.map((configuration) => configuration.code),
        ),
      ),
    ),
  ),
);

try {
  await db.$connect();
  await db.$transaction(
    async (tx) => {
      // Defense in depth: PostgreSQL rejects any accidental writes in this audit.
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      process.stdout.write(
        `${JSON.stringify({ recordType: 'header', standard: VEHICLE_DATA_STANDARD, readOnly: true, consistentSnapshot: true, canonicalComparison: 'NOT_COMPARED', generatedAt: new Date().toISOString() })}\n`,
      );
      let after: string | undefined;
      let total = 0;
      const configurationIntervals = new Map<
        string,
        Array<{ id: string; identityCode: string; start: number; end: number }>
      >();
      for (;;) {
        const records = await tx.vehicleConfiguration.findMany({
          ...(after ? { cursor: { id: after }, skip: 1 } : {}),
          take: pageSize,
          orderBy: { id: 'asc' },
          include: {
            model: true,
            generation: { include: { derivative: true } },
            trim: true,
            make: true,
            engine: true,
            transmission: true,
            bodyType: true,
            market: true,
            _count: {
              select: {
                compatibilities: true,
                vehicleProfiles: true,
                identifierMappings: true,
                marketApplicabilities: true,
              },
            },
          },
        });
        if (records.length === 0) break;
        const ids = records.map((row) => row.id);
        const [provenance, audit, external, localizations] = await Promise.all([
          tx.masterDataProvenance.findMany({
            where: {
              entityType: 'VehicleConfiguration',
              entityId: { in: ids },
            },
            select: {
              entityId: true,
              verificationState: true,
              sourceName: true,
              sourceReference: true,
              sourceUrl: true,
              sourceKind: true,
              verificationReference: true,
            },
          }),
          tx.auditLog.groupBy({
            by: ['entityId'],
            where: {
              entityType: 'VehicleConfiguration',
              entityId: { in: ids },
            },
            _count: { _all: true },
          }),
          tx.externalStandardMapping.groupBy({
            by: ['entityId'],
            where: {
              entityType: 'VehicleConfiguration',
              entityId: { in: ids },
            },
            _count: { _all: true },
          }),
          tx.masterDataLocalization.groupBy({
            by: ['entityId'],
            where: {
              entityType: 'VehicleConfiguration',
              entityId: { in: ids },
            },
            _count: { _all: true },
          }),
        ]);
        const auditCounts = new Map(
          audit.map((row) => [row.entityId, row._count._all]),
        );
        const externalCounts = new Map(
          external.map((row) => [row.entityId, row._count._all]),
        );
        const localizationCounts = new Map(
          localizations.map((row) => [row.entityId, row._count._all]),
        );
        const sourcesById = new Map<string, typeof provenance>();
        for (const source of provenance) {
          const bucket = sourcesById.get(source.entityId) ?? [];
          bucket.push(source);
          sourcesById.set(source.entityId, bucket);
        }
        for (const row of records) {
          const issues: string[] = [];
          if (
            row.model.makeId !== row.makeId ||
            row.generation?.modelId !== row.modelId ||
            row.trim?.generationId !== row.generationId ||
            (row.generation?.derivative &&
              row.generation.derivative.modelId !== row.modelId)
          )
            issues.push('Hierarchy mismatch or missing Generation/Trim');
          if (
            !row.engineId ||
            !row.transmissionId ||
            !row.bodyTypeId ||
            !row.steeringSide
          )
            issues.push('Incomplete fitment identity');
          const start = row.productionStartYear;
          const end = row.productionEndYear;
          if (start === null || (end !== null && start > end))
            issues.push('Missing or reversed production range');
          if ((row.productionEndStatus === 'ENDED') !== (end !== null))
            issues.push('Production end-status contradiction');
          if (
            (row.productionStartMonth !== null &&
              (start === null ||
                row.productionStartMonth < 1 ||
                row.productionStartMonth > 12)) ||
            (row.productionEndMonth !== null &&
              (end === null ||
                row.productionEndMonth < 1 ||
                row.productionEndMonth > 12))
          )
            issues.push('Invalid production month/year');
          if (
            start !== null &&
            end === start &&
            row.productionStartMonth !== null &&
            row.productionEndMonth !== null &&
            row.productionStartMonth > row.productionEndMonth
          )
            issues.push('Reversed production months');
          const parents = [
            row.generation,
            row.trim,
            row.engine,
            row.transmission,
          ];
          for (const parent of parents) {
            if (
              parent &&
              ((parent.startYear !== null &&
                (start === null || start < parent.startYear)) ||
                (parent.endYear !== null &&
                  (end === null || end > parent.endYear)))
            )
              issues.push(
                'Production applicability outside a parent/technical master',
              );
            if (
              parent &&
              row.modelYear !== null &&
              ((parent.startYear !== null &&
                row.modelYear < parent.startYear) ||
                (parent.endYear !== null && row.modelYear > parent.endYear))
            )
              issues.push('Model year outside a parent/technical master');
          }
          if (
            row.modelYear !== null &&
            ((start !== null && row.modelYear < start) ||
              (end !== null && row.modelYear > end))
          )
            issues.push('Model year outside configuration production');
          if (
            row.productionEndStatus === 'CURRENT' &&
            (row.generation?.endStatus !== 'CURRENT' ||
              parents.some(
                (parent) =>
                  parent?.endYear !== null && parent?.endYear !== undefined,
              ))
          )
            issues.push('CURRENT conflicts with parent/technical master');
          if (
            row.status === 'ACTIVE' &&
            [
              row.make,
              row.model,
              row.generation,
              row.generation?.derivative,
              row.trim,
              row.engine,
              row.transmission,
              row.bodyType,
              row.market,
            ].some((parent) => parent && parent.status !== 'ACTIVE')
          )
            issues.push('Inactive parent reference');
          // The existing single market cannot prove distinct TARGET/SOURCE applicability.
          issues.push(
            'Legacy single-market assignment requires explicit Ethiopia TARGET and source-market review',
          );
          if (
            start !== null &&
            row.generationId &&
            row.trimId &&
            row.engineId &&
            row.transmissionId &&
            row.bodyTypeId &&
            row.steeringSide
          ) {
            const key = JSON.stringify([
              row.makeId,
              row.modelId,
              row.generationId,
              row.trimId,
              row.engineId,
              row.transmissionId,
              row.bodyTypeId,
              row.steeringSide,
              row.driveType ?? row.transmission?.driveType ?? null,
              row.materialMarketVariant,
            ]);
            const bucket = configurationIntervals.get(key) ?? [];
            bucket.push({
              id: row.id,
              identityCode: row.identityCode,
              start: start * 12 + (row.productionStartMonth ?? 1) - 1,
              end:
                end === null
                  ? Infinity
                  : end * 12 + (row.productionEndMonth ?? 12) - 1,
            });
            configurationIntervals.set(key, bucket);
          }
          const sources = sourcesById.get(row.id) ?? [];
          const report = classifyVehicleReconstructionRecord({
            entityType: 'VehicleConfiguration',
            id: row.id,
            code: row.code,
            status: row.status,
            version: row.version,
            steeringSide: row.steeringSide,
            marketCode: row.market?.code,
            legacyLibraryMatch: row.code !== null && legacyCodes.has(row.code),
            hasVerifiedProvenance: sources.some(
              (source) =>
                source.verificationState === 'VERIFIED' &&
                source.sourceKind !== null &&
                source.sourceKind !== 'SECONDARY' &&
                Boolean(source.verificationReference) &&
                Boolean(source.sourceReference || source.sourceUrl),
            ),
            issues,
            canonicalMatch: 'NOT_COMPARED',
            references: {
              fitments: row._count.compatibilities,
              profiles: row._count.vehicleProfiles,
              identifiers: row._count.identifierMappings,
              auditHistory: auditCounts.get(row.id) ?? 0,
              provenance: sources.length,
              externalMappings: externalCounts.get(row.id) ?? 0,
              localizations: localizationCounts.get(row.id) ?? 0,
              marketApplicabilities: row._count.marketApplicabilities,
            },
          });
          process.stdout.write(
            `${JSON.stringify({ recordType: 'configuration', ...report, identityCode: row.identityCode, sourceMarket: row.market?.code ?? null })}\n`,
          );
          total++;
        }
        after = records.at(-1)?.id;
      }
      let overlapCandidates = 0;
      for (const bucket of configurationIntervals.values()) {
        bucket.sort((a, b) => a.start - b.start);
        let previous: (typeof bucket)[number] | undefined;
        for (const interval of bucket) {
          if (previous && interval.start <= previous.end) {
            overlapCandidates++;
            process.stdout.write(
              `${JSON.stringify({ recordType: 'configurationOverlap', configurationId: interval.id, conflictingConfigurationId: previous.id, identityCode: interval.identityCode, requiresHumanReview: true, mutationAuthorized: false, reason: 'Potential overlapping mechanical identity; source markets alone must not duplicate a vehicle' })}\n`,
            );
          }
          if (!previous || interval.end > previous.end) previous = interval;
        }
      }
      type SupportingRow = {
        id: string;
        code: string | null;
        name?: string;
        status: string;
        version: number;
        scope: string;
        references: Record<string, number>;
        issues: string[];
      };
      const page = (cursor?: string) => ({
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: pageSize,
        orderBy: { id: 'asc' as const },
      });
      const resources: Array<{
        entityType: string;
        load: (cursor?: string) => Promise<SupportingRow[]>;
      }> = [
        {
          entityType: 'VehicleMake',
          load: async (cursor) =>
            (
              await tx.vehicleMake.findMany({
                ...page(cursor),
                include: {
                  _count: {
                    select: {
                      models: true,
                      configurations: true,
                      compatibilities: true,
                    },
                  },
                },
              })
            ).map((row) => ({
              ...row,
              scope: '',
              references: {
                models: row._count.models,
                configurations: row._count.configurations,
                fitments: row._count.compatibilities,
              },
              issues: [],
            })),
        },
        {
          entityType: 'VehicleModel',
          load: async (cursor) =>
            (
              await tx.vehicleModel.findMany({
                ...page(cursor),
                include: {
                  make: true,
                  _count: {
                    select: {
                      derivatives: true,
                      generations: true,
                      configurations: true,
                      compatibilities: true,
                    },
                  },
                },
              })
            ).map((row) => ({
              ...row,
              scope: row.makeId,
              references: {
                derivatives: row._count.derivatives,
                generations: row._count.generations,
                configurations: row._count.configurations,
                fitments: row._count.compatibilities,
              },
              issues:
                row.status === 'ACTIVE' && row.make.status !== 'ACTIVE'
                  ? ['Inactive Make reference']
                  : [],
            })),
        },
        {
          entityType: 'VehicleModelDerivative',
          load: async (cursor) =>
            (
              await tx.vehicleModelDerivative.findMany({
                ...page(cursor),
                include: {
                  model: true,
                  _count: { select: { generations: true } },
                },
              })
            ).map((row) => ({
              ...row,
              scope: row.modelId,
              references: { generations: row._count.generations },
              issues:
                row.status === 'ACTIVE' && row.model.status !== 'ACTIVE'
                  ? ['Inactive Model reference']
                  : [],
            })),
        },
        {
          entityType: 'VehicleGeneration',
          load: async (cursor) =>
            (
              await tx.vehicleGeneration.findMany({
                ...page(cursor),
                include: {
                  model: true,
                  derivative: true,
                  _count: {
                    select: {
                      trims: true,
                      configurations: true,
                      compatibilities: true,
                    },
                  },
                },
              })
            ).map((row) => {
              const issues: string[] = [];
              if (row.derivative && row.derivative.modelId !== row.modelId)
                issues.push('Derivative/Model mismatch');
              if (
                row.startYear === null ||
                (row.endYear !== null && row.startYear > row.endYear)
              )
                issues.push('Invalid Generation range');
              if ((row.endStatus === 'ENDED') !== (row.endYear !== null))
                issues.push('Generation end-status contradiction');
              if (
                row.status === 'ACTIVE' &&
                (row.model.status !== 'ACTIVE' ||
                  (row.derivative && row.derivative.status !== 'ACTIVE'))
              )
                issues.push('Inactive parent reference');
              return {
                ...row,
                scope: `${row.modelId}:${row.derivativeId ?? ''}`,
                references: {
                  trims: row._count.trims,
                  configurations: row._count.configurations,
                  fitments: row._count.compatibilities,
                },
                issues,
              };
            }),
        },
        {
          entityType: 'VehicleTrim',
          load: async (cursor) =>
            (
              await tx.vehicleTrim.findMany({
                ...page(cursor),
                include: {
                  generation: true,
                  _count: {
                    select: { configurations: true, compatibilities: true },
                  },
                },
              })
            ).map((row) => {
              const issues: string[] = [];
              if (
                row.startYear === null ||
                (row.endYear !== null && row.startYear > row.endYear)
              )
                issues.push('Invalid Trim range');
              if (
                (row.generation.startYear !== null &&
                  (row.startYear === null ||
                    row.startYear < row.generation.startYear)) ||
                (row.generation.endYear !== null &&
                  (row.endYear === null ||
                    row.endYear > row.generation.endYear))
              )
                issues.push('Trim outside Generation');
              if (row.status === 'ACTIVE' && row.generation.status !== 'ACTIVE')
                issues.push('Inactive Generation reference');
              return {
                ...row,
                scope: row.generationId,
                references: {
                  configurations: row._count.configurations,
                  fitments: row._count.compatibilities,
                },
                issues,
              };
            }),
        },
        {
          entityType: 'VehicleEngine',
          load: async (cursor) =>
            (
              await tx.vehicleEngine.findMany({
                ...page(cursor),
                include: {
                  _count: {
                    select: { configurations: true, compatibilities: true },
                  },
                },
              })
            ).map((row) => ({
              ...row,
              scope: '',
              references: {
                configurations: row._count.configurations,
                fitments: row._count.compatibilities,
              },
              issues:
                row.endYear !== null &&
                (row.startYear === null || row.startYear > row.endYear)
                  ? ['Invalid Engine range']
                  : [],
            })),
        },
        {
          entityType: 'VehicleTransmission',
          load: async (cursor) =>
            (
              await tx.vehicleTransmission.findMany({
                ...page(cursor),
                include: {
                  _count: {
                    select: { configurations: true, compatibilities: true },
                  },
                },
              })
            ).map((row) => ({
              ...row,
              scope: '',
              references: {
                configurations: row._count.configurations,
                fitments: row._count.compatibilities,
              },
              issues:
                row.endYear !== null &&
                (row.startYear === null || row.startYear > row.endYear)
                  ? ['Invalid Transmission range']
                  : [],
            })),
        },
        {
          entityType: 'VehicleBodyType',
          load: async (cursor) =>
            (
              await tx.vehicleBodyType.findMany({
                ...page(cursor),
                include: {
                  _count: {
                    select: { configurations: true, compatibilities: true },
                  },
                },
              })
            ).map((row) => ({
              ...row,
              scope: '',
              references: {
                configurations: row._count.configurations,
                fitments: row._count.compatibilities,
              },
              issues: [],
            })),
        },
        {
          entityType: 'VehicleMarket',
          load: async (cursor) =>
            (
              await tx.vehicleMarket.findMany({
                ...page(cursor),
                include: {
                  _count: {
                    select: {
                      configurations: true,
                      compatibilities: true,
                      applicability: true,
                    },
                  },
                },
              })
            ).map((row) => ({
              ...row,
              scope: '',
              references: {
                configurations: row._count.configurations,
                fitments: row._count.compatibilities,
                marketApplicabilities: row._count.applicability,
              },
              issues:
                row.kind === null
                  ? [
                      'Unclassified legacy Market; TARGET/SOURCE roles cannot be inferred',
                    ]
                  : [],
            })),
        },
      ];
      for (const resource of resources) {
        let cursor: string | undefined;
        const seen = new Map<string, string>();
        for (;;) {
          const records = await resource.load(cursor);
          if (records.length === 0) break;
          const ids = records.map((row) => row.id);
          const filter = {
            entityType: resource.entityType,
            entityId: { in: ids },
          };
          const [sources, history, mappings, localized] = await Promise.all([
            tx.masterDataProvenance.findMany({
              where: filter,
              select: {
                entityId: true,
                verificationState: true,
                sourceReference: true,
                sourceUrl: true,
                sourceKind: true,
                verificationReference: true,
              },
            }),
            tx.auditLog.groupBy({
              by: ['entityId'],
              where: filter,
              _count: { _all: true },
            }),
            tx.externalStandardMapping.groupBy({
              by: ['entityId'],
              where: filter,
              _count: { _all: true },
            }),
            tx.masterDataLocalization.groupBy({
              by: ['entityId'],
              where: filter,
              _count: { _all: true },
            }),
          ]);
          const sourceCounts = new Map<string, number>();
          const verified = new Set<string>();
          for (const source of sources) {
            sourceCounts.set(
              source.entityId,
              (sourceCounts.get(source.entityId) ?? 0) + 1,
            );
            if (
              source.verificationState === 'VERIFIED' &&
              source.sourceKind !== null &&
              source.sourceKind !== 'SECONDARY' &&
              Boolean(source.verificationReference) &&
              (source.sourceReference || source.sourceUrl)
            )
              verified.add(source.entityId);
          }
          const historyCounts = new Map(
            history.map((row) => [row.entityId, row._count._all]),
          );
          const mappingCounts = new Map(
            mappings.map((row) => [row.entityId, row._count._all]),
          );
          const localizedCounts = new Map(
            localized.map((row) => [row.entityId, row._count._all]),
          );
          for (const row of records) {
            for (const dimension of [
              row.code,
              row.name?.trim().toLowerCase(),
            ]) {
              if (!dimension) continue;
              const key = `${row.scope}:${dimension}`;
              const duplicate = seen.get(key);
              if (duplicate && duplicate !== row.id)
                row.issues.push(
                  `Possible duplicate master identity: ${duplicate}; source comparison required`,
                );
              else seen.set(key, row.id);
            }
            process.stdout.write(
              `${JSON.stringify({ recordType: 'supportingMaster', ...classifyVehicleReconstructionRecord({ entityType: resource.entityType, id: row.id, code: row.code, status: row.status, version: row.version, issues: row.issues, hasVerifiedProvenance: verified.has(row.id), canonicalMatch: 'NOT_COMPARED', references: { ...row.references, auditHistory: historyCounts.get(row.id) ?? 0, provenance: sourceCounts.get(row.id) ?? 0, externalMappings: mappingCounts.get(row.id) ?? 0, localizations: localizedCounts.get(row.id) ?? 0 } }) })}\n`,
            );
          }
          cursor = records.at(-1)?.id;
        }
      }
      const supportingCounts = await Promise.all([
        tx.vehicleMake.count(),
        tx.vehicleModel.count(),
        tx.vehicleModelDerivative.count(),
        tx.vehicleGeneration.count(),
        tx.vehicleTrim.count(),
        tx.vehicleEngine.count(),
        tx.vehicleTransmission.count(),
        tx.vehicleBodyType.count(),
        tx.vehicleMarket.count(),
      ]);
      process.stdout.write(
        `${JSON.stringify({ recordType: 'summary', complete: true, configurations: total, overlapCandidates, supportingCounts: Object.fromEntries(['makes', 'models', 'derivatives', 'generations', 'trims', 'engines', 'transmissions', 'bodyTypes', 'markets'].map((key, index) => [key, supportingCounts[index]])), supportingRecordsClassified: true, destructiveOperationsRun: false, nextGate: 'Review supporting masters, source evidence, duplicates and a locked live reference-migration plan before applying changes' })}\n`,
      );
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 300_000,
      maxWait: 10_000,
    },
  );
} finally {
  await db.$disconnect();
}
