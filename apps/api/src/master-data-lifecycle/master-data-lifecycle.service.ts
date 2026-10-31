import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  ProductStatus,
  ProvenanceVerificationState,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import {
  MasterDataLifecycleEntityType,
  type DeleteMasterDataRecordDto,
  type DeleteMasterDataRecordResponseDto,
  type MasterDataLifecycleStateResponseDto,
  type MasterDataRemovalDependencyResponseDto,
  type MasterDataRemovalPreflightResponseDto,
  type RestoreMasterDataLifecycleDto,
  type TransitionMasterDataLifecycleDto,
} from './dto/master-data-lifecycle.dto.js';

type LifecycleDomain = 'CATALOG' | 'VEHICLE' | 'SOURCING';

type MasterRecord = {
  id: string;
  status: MasterDataStatus;
  version: number;
};

type RemovalDependency = MasterDataRemovalDependencyResponseDto;

const catalogEntities = new Set<MasterDataLifecycleEntityType>([
  MasterDataLifecycleEntityType.CATEGORY,
  MasterDataLifecycleEntityType.PRODUCT_FAMILY,
  MasterDataLifecycleEntityType.PRODUCT_TYPE,
  MasterDataLifecycleEntityType.ATTRIBUTE_DEFINITION,
  MasterDataLifecycleEntityType.ATTRIBUTE_GROUP,
  MasterDataLifecycleEntityType.ATTRIBUTE_ALLOWED_VALUE,
  MasterDataLifecycleEntityType.CRITERIA_TEMPLATE,
  MasterDataLifecycleEntityType.BRAND,
  MasterDataLifecycleEntityType.UNIT_OF_MEASURE,
]);

const sourcingEntities = new Set<MasterDataLifecycleEntityType>([
  MasterDataLifecycleEntityType.SUPPLIER,
]);

const vehicleEntities = new Set<MasterDataLifecycleEntityType>([
  MasterDataLifecycleEntityType.VEHICLE_MAKE,
  MasterDataLifecycleEntityType.VEHICLE_MODEL,
  MasterDataLifecycleEntityType.VEHICLE_MODEL_DERIVATIVE,
  MasterDataLifecycleEntityType.VEHICLE_GENERATION,
  MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY,
  MasterDataLifecycleEntityType.VEHICLE_TRIM,
  MasterDataLifecycleEntityType.VEHICLE_ENGINE,
  MasterDataLifecycleEntityType.VEHICLE_TRANSMISSION,
  MasterDataLifecycleEntityType.VEHICLE_BODY_TYPE,
  MasterDataLifecycleEntityType.VEHICLE_MARKET,
  MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION,
]);

@Injectable()
export class MasterDataLifecycleService {
  constructor(private readonly database: DatabaseService) {}

  async getState(
    domain: LifecycleDomain,
    entityType: MasterDataLifecycleEntityType,
    entityId: string,
  ): Promise<MasterDataLifecycleStateResponseDto> {
    this.assertDomainEntity(domain, entityType);
    const current = await this.getRecord(this.database, entityType, entityId);
    if (!current) throw this.notFound(entityType);

    const latest = await this.database.auditLog.findFirst({
      where: {
        action: 'MASTER_DATA_LIFECYCLE_TRANSITIONED',
        entityType: this.auditEntityType(entityType),
        entityId,
      },
      select: { metadata: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const metadata = this.record(latest?.metadata);
    const after = this.record(metadata?.after);
    const metadataMatchesCurrentState =
      this.stringValue(after?.status) === current.status;
    const allowedNextStatuses = this.allowedNextStatuses(current.status);

    return {
      entityType,
      entityId,
      status: current.status,
      version: current.version,
      supersededById: metadataMatchesCurrentState
        ? this.stringValue(metadata?.supersededById)
        : null,
      reason: metadataMatchesCurrentState
        ? this.stringValue(metadata?.reason)
        : null,
      sourceReference: metadataMatchesCurrentState
        ? this.stringValue(metadata?.sourceReference)
        : null,
      allowedNextStatuses,
      activationWorkflowRequired: allowedNextStatuses.includes(
        MasterDataStatus.ACTIVE,
      ),
      restoreAvailable: current.status === MasterDataStatus.ARCHIVED,
    };
  }

  async transition(
    domain: LifecycleDomain,
    entityType: MasterDataLifecycleEntityType,
    entityId: string,
    input: TransitionMasterDataLifecycleDto,
    actorId: string,
  ): Promise<MasterDataLifecycleStateResponseDto> {
    this.assertDomainEntity(domain, entityType);
    this.assertLifecycleEndpointTarget(input.targetStatus);

    try {
      const result = await this.database.$transaction(
        async (tx) => {
          const current = await this.getRecord(tx, entityType, entityId);
          if (!current) throw this.notFound(entityType);
          if (current.version !== input.version) {
            throw this.versionConflict(entityType);
          }

          this.assertTransition(current.status, input.targetStatus);

          const reason = input.reason?.trim() || null;
          const sourceReference = input.sourceReference?.trim() || null;
          let supersededById: string | null = null;

          if (input.targetStatus === MasterDataStatus.SUPERSEDED) {
            if (!input.supersededById) {
              throw new BadRequestException({
                code: 'MASTER_DATA_SUPERSESSION_TARGET_REQUIRED',
                message:
                  'SUPERSEDED master data requires an ACTIVE replacement of the same entity type.',
              });
            }
            supersededById = input.supersededById;
            await this.assertReplacement(
              tx,
              entityType,
              entityId,
              supersededById,
            );
          } else {
            if (input.supersededById) {
              throw new BadRequestException({
                code: 'MASTER_DATA_SUPERSESSION_TARGET_NOT_ALLOWED',
                message:
                  'supersededById is only valid when targetStatus is SUPERSEDED.',
              });
            }

            if (
              current.status === MasterDataStatus.SUPERSEDED &&
              input.targetStatus === MasterDataStatus.ARCHIVED
            ) {
              supersededById = await this.currentSupersessionTarget(
                tx,
                entityType,
                entityId,
              );
            }
          }

          if (input.targetStatus === MasterDataStatus.ARCHIVED) {
            await this.assertNoActiveDependents(tx, entityType, entityId);
          }

          const updated = await this.updateRecord(
            tx,
            entityType,
            entityId,
            input.version,
            input.targetStatus,
            actorId,
          );

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'MASTER_DATA_LIFECYCLE_TRANSITIONED',
              entityType: this.auditEntityType(entityType),
              entityId,
              metadata: {
                lifecycleEntityType: entityType,
                before: {
                  status: current.status,
                  version: current.version,
                },
                after: {
                  status: updated.status,
                  version: updated.version,
                },
                reason,
                supersededById,
                sourceReference,
              },
            },
          });

          return {
            current: updated,
            supersededById,
            reason,
            sourceReference,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const allowedNextStatuses = this.allowedNextStatuses(
        result.current.status,
      );
      return {
        entityType,
        entityId,
        status: result.current.status,
        version: result.current.version,
        supersededById: result.supersededById,
        reason: result.reason,
        sourceReference: result.sourceReference,
        allowedNextStatuses,
        activationWorkflowRequired: allowedNextStatuses.includes(
          MasterDataStatus.ACTIVE,
        ),
        restoreAvailable: result.current.status === MasterDataStatus.ARCHIVED,
      };
    } catch (error) {
      this.rethrowPersistence(error, entityType);
    }
  }

  async removalPreflight(
    domain: LifecycleDomain,
    entityType: MasterDataLifecycleEntityType,
    entityId: string,
  ): Promise<MasterDataRemovalPreflightResponseDto> {
    this.assertDomainEntity(domain, entityType);
    const current = await this.getRecord(this.database, entityType, entityId);
    if (!current) throw this.notFound(entityType);

    const dependencies = await this.collectRemovalDependencies(
      this.database,
      entityType,
      entityId,
    );

    return this.buildRemovalPreflight(entityType, current, dependencies);
  }

  async restore(
    domain: LifecycleDomain,
    entityType: MasterDataLifecycleEntityType,
    entityId: string,
    input: RestoreMasterDataLifecycleDto,
    actorId: string,
  ): Promise<MasterDataLifecycleStateResponseDto> {
    this.assertDomainEntity(domain, entityType);

    try {
      const result = await this.database.$transaction(
        async (tx) => {
          const current = await this.getRecord(tx, entityType, entityId);
          if (!current) throw this.notFound(entityType);
          if (current.version !== input.version) {
            throw this.versionConflict(entityType);
          }
          if (current.status !== MasterDataStatus.ARCHIVED) {
            throw new ConflictException({
              code: 'MASTER_DATA_RESTORE_STATUS_INVALID',
              message: 'Only ARCHIVED master records can be restored.',
              details: { currentStatus: current.status },
            });
          }

          const restored = await this.updateRecord(
            tx,
            entityType,
            entityId,
            input.version,
            MasterDataStatus.DEPRECATED,
            actorId,
          );

          const reason = input.reason?.trim() || null;
          const sourceReference = input.sourceReference?.trim() || null;
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'MASTER_DATA_LIFECYCLE_RESTORED',
              entityType: this.auditEntityType(entityType),
              entityId,
              metadata: {
                lifecycleEntityType: entityType,
                before: {
                  status: current.status,
                  version: current.version,
                },
                after: {
                  status: restored.status,
                  version: restored.version,
                },
                reason,
                sourceReference,
              },
            },
          });

          return { current: restored, reason, sourceReference };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const allowedNextStatuses = this.allowedNextStatuses(
        result.current.status,
      );
      return {
        entityType,
        entityId,
        status: result.current.status,
        version: result.current.version,
        supersededById: null,
        reason: result.reason,
        sourceReference: result.sourceReference,
        allowedNextStatuses,
        activationWorkflowRequired: allowedNextStatuses.includes(
          MasterDataStatus.ACTIVE,
        ),
        restoreAvailable: false,
      };
    } catch (error) {
      this.rethrowPersistence(error, entityType);
    }
  }

  async permanentDelete(
    domain: LifecycleDomain,
    entityType: MasterDataLifecycleEntityType,
    entityId: string,
    input: DeleteMasterDataRecordDto,
    actorId: string,
  ): Promise<DeleteMasterDataRecordResponseDto> {
    this.assertDomainEntity(domain, entityType);

    try {
      return await this.database.$transaction(
        async (tx) => {
          const current = await this.getRecord(tx, entityType, entityId);
          if (!current) throw this.notFound(entityType);
          if (current.version !== input.version) {
            throw this.versionConflict(entityType);
          }

          const dependencies = await this.collectRemovalDependencies(
            tx,
            entityType,
            entityId,
          );
          const preflight = this.buildRemovalPreflight(
            entityType,
            current,
            dependencies,
          );

          if (!preflight.canPermanentlyDelete) {
            throw new ConflictException({
              code: 'MASTER_DATA_PERMANENT_DELETE_BLOCKED',
              message:
                preflight.blockers[0] ??
                'This master record cannot be permanently deleted.',
              details: preflight,
            });
          }

          const deleted = await this.deleteRecord(
            tx,
            entityType,
            entityId,
            input.version,
          );
          if (deleted !== 1) {
            throw this.versionConflict(entityType);
          }

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'MASTER_DATA_PERMANENTLY_DELETED',
              entityType: this.auditEntityType(entityType),
              entityId,
              metadata: {
                lifecycleEntityType: entityType,
                before: {
                  status: current.status,
                  version: current.version,
                },
                reason: input.reason.trim(),
                deletionPolicy: preflight.deletionPolicy,
              },
            },
          });

          return { entityType, entityId, deleted: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistence(error, entityType);
    }
  }

  private assertDomainEntity(
    domain: LifecycleDomain,
    entityType: MasterDataLifecycleEntityType,
  ): void {
    const valid =
      domain === 'CATALOG'
        ? catalogEntities.has(entityType)
        : domain === 'VEHICLE'
          ? vehicleEntities.has(entityType)
          : sourcingEntities.has(entityType);

    if (!valid) {
      throw new BadRequestException({
        code: 'MASTER_DATA_LIFECYCLE_DOMAIN_MISMATCH',
        message: `${entityType} is not governed by the ${domain.toLowerCase()} lifecycle endpoint.`,
      });
    }
  }

  private assertLifecycleEndpointTarget(status: MasterDataStatus): void {
    if (
      status !== MasterDataStatus.DEPRECATED &&
      status !== MasterDataStatus.SUPERSEDED &&
      status !== MasterDataStatus.ARCHIVED
    ) {
      throw new BadRequestException({
        code: 'MASTER_DATA_LIFECYCLE_TARGET_INVALID',
        message:
          'Use normal entity activation/edit workflows for DRAFT/ACTIVE. This lifecycle endpoint governs DEPRECATED, SUPERSEDED and ARCHIVED transitions.',
      });
    }
  }

  private assertTransition(
    current: MasterDataStatus,
    target: MasterDataStatus,
  ): void {
    if (current === target) {
      throw new ConflictException({
        code: 'MASTER_DATA_LIFECYCLE_NO_CHANGE',
        message: 'The requested lifecycle state is already current.',
      });
    }

    const allowed = this.allowedNextStatuses(current);
    if (!allowed.includes(target)) {
      throw new ConflictException({
        code: 'MASTER_DATA_LIFECYCLE_TRANSITION_INVALID',
        message: `Lifecycle transition ${current} -> ${target} is not allowed.`,
        details: { currentStatus: current, targetStatus: target, allowed },
      });
    }
  }

  private allowedNextStatuses(status: MasterDataStatus): MasterDataStatus[] {
    switch (status) {
      case MasterDataStatus.DRAFT:
        return [MasterDataStatus.ACTIVE, MasterDataStatus.ARCHIVED];
      case MasterDataStatus.ACTIVE:
        return [
          MasterDataStatus.DEPRECATED,
          MasterDataStatus.SUPERSEDED,
          MasterDataStatus.ARCHIVED,
        ];
      case MasterDataStatus.DEPRECATED:
        return [
          MasterDataStatus.ACTIVE,
          MasterDataStatus.SUPERSEDED,
          MasterDataStatus.ARCHIVED,
        ];
      case MasterDataStatus.SUPERSEDED:
        return [MasterDataStatus.ARCHIVED];
      case MasterDataStatus.INACTIVE:
        return [
          MasterDataStatus.ACTIVE,
          MasterDataStatus.DEPRECATED,
          MasterDataStatus.ARCHIVED,
        ];
      case MasterDataStatus.ARCHIVED:
        return [];
    }
  }

  private async assertReplacement(
    tx: Prisma.TransactionClient,
    entityType: MasterDataLifecycleEntityType,
    entityId: string,
    replacementId: string,
  ): Promise<void> {
    if (replacementId === entityId) {
      throw new BadRequestException({
        code: 'MASTER_DATA_SUPERSESSION_SELF_REFERENCE',
        message: 'Master data cannot supersede itself.',
      });
    }

    const replacement = await this.getRecord(
      tx,
      entityType,
      replacementId,
    );
    if (!replacement) {
      throw new BadRequestException({
        code: 'MASTER_DATA_SUPERSESSION_TARGET_NOT_FOUND',
        message: 'The selected supersession target does not exist.',
      });
    }
    if (replacement.status !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'MASTER_DATA_SUPERSESSION_TARGET_NOT_ACTIVE',
        message: 'The supersession target must be ACTIVE.',
      });
    }
    if (entityType === MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY) {
      const [currentFamily, replacementFamily] = await Promise.all([
        tx.vehicleGenerationFamily.findUnique({ where: { id: entityId }, select: { modelId: true } }),
        tx.vehicleGenerationFamily.findUnique({ where: { id: replacementId }, select: { modelId: true } }),
      ]);
      if (!currentFamily || !replacementFamily || currentFamily.modelId !== replacementFamily.modelId) {
        throw new ConflictException({ code: 'GENERATION_FAMILY_SUPERSESSION_MODEL_MISMATCH',
          message: 'A replacement Generation Family must belong to the same Model.' });
      }
    }
  }

  private async currentSupersessionTarget(
    tx: Prisma.TransactionClient,
    entityType: MasterDataLifecycleEntityType,
    entityId: string,
  ): Promise<string> {
    const latest = await tx.auditLog.findFirst({
      where: {
        action: 'MASTER_DATA_LIFECYCLE_TRANSITIONED',
        entityType: this.auditEntityType(entityType),
        entityId,
      },
      select: { metadata: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const metadata = this.record(latest?.metadata);
    const after = this.record(metadata?.after);
    const replacementId = this.stringValue(metadata?.supersededById);

    if (
      this.stringValue(after?.status) !== MasterDataStatus.SUPERSEDED ||
      !replacementId
    ) {
      throw new ConflictException({
        code: 'MASTER_DATA_SUPERSESSION_HISTORY_INVALID',
        message:
          'The superseded record is missing its governed replacement history and cannot be archived safely.',
      });
    }

    return replacementId;
  }

  private async assertNoActiveDependents(
    tx: Prisma.TransactionClient,
    entityType: MasterDataLifecycleEntityType,
    id: string,
  ): Promise<void> {
    let dependency: { id: string } | null = null;

    switch (entityType) {
      case MasterDataLifecycleEntityType.CATEGORY:
        dependency =
          (await tx.category.findFirst({
            where: { parentId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productFamily.findFirst({
            where: { categoryId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productType.findFirst({
            where: { categoryId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.product.findFirst({
            where: { categoryId: id, status: ProductStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.PRODUCT_FAMILY:
        dependency =
          (await tx.productType.findFirst({
            where: { productFamilyId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.product.findFirst({
            where: { productFamilyId: id, status: ProductStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productTypeCriteriaTemplate.findFirst({
            where: {
              productFamilyId: id,
              status: MasterDataStatus.ACTIVE,
            },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.PRODUCT_TYPE:
        dependency =
          (await tx.productType.findFirst({
            where: { parentId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.product.findFirst({
            where: { productTypeId: id, status: ProductStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productTypeAttributeAssignment.findFirst({
            where: { productTypeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productTypeCriteriaTemplateTarget
            .findFirst({
              where: {
                productTypeId: id,
                template: { status: MasterDataStatus.ACTIVE },
              },
              select: { productTypeId: true },
            })
            .then((target) =>
              target ? { id: target.productTypeId } : null,
            ));
        break;
      case MasterDataLifecycleEntityType.ATTRIBUTE_DEFINITION:
        dependency =
          (await tx.attributeAllowedValue.findFirst({
            where: { attributeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productTypeAttributeAssignment.findFirst({
            where: { attributeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productAttributeValue.findFirst({
            where: {
              attributeId: id,
              product: { status: ProductStatus.ACTIVE },
            },
            select: { id: true },
          })) ??
          (await tx.productTypeCriteriaTemplateItem.findFirst({
            where: { attributeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.ATTRIBUTE_GROUP:
        dependency = await tx.attributeDefinition.findFirst({
          where: { groupId: id, status: MasterDataStatus.ACTIVE },
          select: { id: true },
        });
        break;
      case MasterDataLifecycleEntityType.ATTRIBUTE_ALLOWED_VALUE:
        dependency = null;
        break;
      case MasterDataLifecycleEntityType.CRITERIA_TEMPLATE:
        dependency =
          (await tx.productTypeCriteriaTemplateItem.findFirst({
            where: { templateId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.productTypeCriteriaTemplateTarget
            .findFirst({
              where: { templateId: id },
              select: { productTypeId: true },
            })
            .then((target) =>
              target ? { id: target.productTypeId } : null,
            ));
        break;
      case MasterDataLifecycleEntityType.BRAND:
        dependency =
          (await tx.product.findFirst({
            where: { brandId: id, status: ProductStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.partNumber.findFirst({
            where: {
              issuerBrandId: id,
              product: { status: ProductStatus.ACTIVE },
            },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.UNIT_OF_MEASURE:
        dependency = await tx.product.findFirst({
          where: { unitOfMeasureId: id, status: ProductStatus.ACTIVE },
          select: { id: true },
        });
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MAKE:
        dependency =
          (await tx.vehicleModel.findFirst({
            where: { makeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleConfiguration.findFirst({
            where: { makeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { makeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MODEL:
        dependency =
          (await tx.vehicleModelDerivative.findFirst({
            where: { modelId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleGenerationFamily.findFirst({
            where: { modelId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleGeneration.findFirst({
            where: { modelId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleConfiguration.findFirst({
            where: { modelId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { modelId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MODEL_DERIVATIVE:
        dependency = await tx.vehicleGeneration.findFirst({
          where: { derivativeId: id, status: MasterDataStatus.ACTIVE },
          select: { id: true },
        });
        break;
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY:
        dependency = await tx.vehicleGeneration.findFirst({
          where: { familyId: id, status: MasterDataStatus.ACTIVE }, select: { id: true },
        });
        break;
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION:
        dependency =
          (await tx.vehicleTrim.findFirst({
            where: { generationId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleConfiguration.findFirst({
            where: { generationId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { generationId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_TRIM:
        dependency =
          (await tx.vehicleConfiguration.findFirst({
            where: { trimId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { trimId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_ENGINE:
        dependency =
          (await tx.vehicleConfiguration.findFirst({
            where: { engineId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { engineId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_TRANSMISSION:
        dependency =
          (await tx.vehicleConfiguration.findFirst({
            where: { transmissionId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { transmissionId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_BODY_TYPE:
        dependency =
          (await tx.vehicleConfiguration.findFirst({
            where: { bodyTypeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { bodyTypeId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MARKET:
        dependency =
          (await tx.vehicleConfiguration.findFirst({
            where: {
              status: MasterDataStatus.ACTIVE,
              OR: [
                { marketId: id },
                { marketApplicabilities: { some: { marketId: id, status: MasterDataStatus.ACTIVE } } },
              ],
            },
            select: { id: true },
          })) ??
          (await tx.vehicleCompatibility.findFirst({
            where: { marketId: id, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION:
        dependency =
          (await tx.vehicleCompatibility.findFirst({
            where: {
              vehicleConfigurationId: id,
              status: MasterDataStatus.ACTIVE,
            },
            select: { id: true },
          })) ??
          (await tx.vehicleIdentifierMapping.findFirst({
            where: {
              vehicleConfigurationId: id,
              status: MasterDataStatus.ACTIVE,
              verificationState: ProvenanceVerificationState.VERIFIED,
            },
            select: { id: true },
          })) ??
          (await tx.vehicleProfile.findFirst({
            where: { vehicleConfigurationId: id },
            select: { id: true },
          }));
        break;
      case MasterDataLifecycleEntityType.SUPPLIER:
        dependency = await tx.supplierOffer.findFirst({
          where: { supplierId: id, status: MasterDataStatus.ACTIVE },
          select: { id: true },
        });
        break;
    }

    if (dependency) {
      throw new ConflictException({
        code: 'MASTER_DATA_HAS_ACTIVE_DEPENDENCIES',
        message:
          'Resolve live dependent records before archiving this master record.',
        details: { entityType, entityId: id, dependencyId: dependency.id },
      });
    }
  }

  private buildRemovalPreflight(
    entityType: MasterDataLifecycleEntityType,
    current: MasterRecord,
    dependencies: RemovalDependency[],
  ): MasterDataRemovalPreflightResponseDto {
    const retainedIdentity =
      entityType === MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION;
    const blockers: string[] = [];

    if (retainedIdentity) {
      blockers.push(
        'Configured Vehicle identities are retained and cannot be permanently deleted.',
      );
    }
    if (current.status !== MasterDataStatus.DRAFT) {
      blockers.push(
        'Permanent deletion is limited to records that are still in DRAFT.',
      );
    }
    if (current.version !== 1) {
      blockers.push(
        'Permanent deletion is limited to unmodified Draft records. Archive this record instead.',
      );
    }
    if (dependencies.length > 0) {
      const dependencyCount = dependencies.reduce(
        (total, dependency) => total + dependency.count,
        0,
      );
      blockers.push(
        `Remove or resolve ${dependencyCount} dependent record${dependencyCount === 1 ? '' : 's'} before permanent deletion.`,
      );
    }

    return {
      entityType,
      entityId: current.id,
      status: current.status,
      version: current.version,
      canPermanentlyDelete: blockers.length === 0,
      deletionPolicy: retainedIdentity
        ? 'RETAINED_IDENTITY'
        : 'DRAFT_ONLY_UNUSED',
      dependencies,
      blockers,
    };
  }

  private async collectRemovalDependencies(
    client: DatabaseService | Prisma.TransactionClient,
    entityType: MasterDataLifecycleEntityType,
    id: string,
  ): Promise<RemovalDependency[]> {
    const dependencies: RemovalDependency[] = [];
    const add = (key: string, label: string, count: number) => {
      if (count > 0) dependencies.push({ key, label, count });
    };

    switch (entityType) {
      case MasterDataLifecycleEntityType.CATEGORY:
        add(
          'childCategories',
          'child Categories',
          await client.category.count({ where: { parentId: id } }),
        );
        add(
          'productFamilies',
          'Part Groups',
          await client.productFamily.count({ where: { categoryId: id } }),
        );
        add(
          'productTypes',
          'Product Types',
          await client.productType.count({ where: { categoryId: id } }),
        );
        add(
          'products',
          'seller Articles',
          await client.product.count({ where: { categoryId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.PRODUCT_FAMILY:
        add(
          'productTypes',
          'Product Types',
          await client.productType.count({ where: { productFamilyId: id } }),
        );
        add(
          'criteriaTemplates',
          'Criteria Templates',
          await client.productTypeCriteriaTemplate.count({
            where: { productFamilyId: id },
          }),
        );
        add(
          'products',
          'seller Articles',
          await client.product.count({ where: { productFamilyId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.PRODUCT_TYPE:
        add(
          'childProductTypes',
          'child Product Types',
          await client.productType.count({ where: { parentId: id } }),
        );
        add(
          'attributeAssignments',
          'Attribute assignments',
          await client.productTypeAttributeAssignment.count({
            where: { productTypeId: id },
          }),
        );
        add(
          'criteriaTemplateTargets',
          'Criteria Template assignments',
          await client.productTypeCriteriaTemplateTarget.count({
            where: { productTypeId: id },
          }),
        );
        add(
          'schemaVersions',
          'published schema versions',
          await client.productTypeSchemaVersion.count({
            where: { productTypeId: id },
          }),
        );
        add(
          'products',
          'seller Articles',
          await client.product.count({ where: { productTypeId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.ATTRIBUTE_DEFINITION:
        add(
          'aliases',
          'Attribute aliases',
          await client.attributeAlias.count({ where: { attributeId: id } }),
        );
        add(
          'allowedValues',
          'controlled Attribute values',
          await client.attributeAllowedValue.count({
            where: { attributeId: id },
          }),
        );
        add(
          'productTypeAssignments',
          'Product Type assignments',
          await client.productTypeAttributeAssignment.count({
            where: { attributeId: id },
          }),
        );
        add(
          'criteriaTemplateItems',
          'Criteria Template items',
          await client.productTypeCriteriaTemplateItem.count({
            where: { attributeId: id },
          }),
        );
        add(
          'productValues',
          'seller Article values',
          await client.productAttributeValue.count({
            where: { attributeId: id },
          }),
        );
        break;
      case MasterDataLifecycleEntityType.ATTRIBUTE_GROUP:
        add(
          'attributes',
          'Attribute Definitions',
          await client.attributeDefinition.count({ where: { groupId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.ATTRIBUTE_ALLOWED_VALUE:
        break;
      case MasterDataLifecycleEntityType.CRITERIA_TEMPLATE:
        add(
          'items',
          'Criteria Template items',
          await client.productTypeCriteriaTemplateItem.count({
            where: { templateId: id },
          }),
        );
        add(
          'targets',
          'Product Type assignments',
          await client.productTypeCriteriaTemplateTarget.count({
            where: { templateId: id },
          }),
        );
        break;
      case MasterDataLifecycleEntityType.BRAND:
        add(
          'products',
          'seller Articles',
          await client.product.count({ where: { brandId: id } }),
        );
        add(
          'partNumbers',
          'part-number references',
          await client.partNumber.count({ where: { issuerBrandId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.UNIT_OF_MEASURE:
        add(
          'products',
          'seller Articles',
          await client.product.count({ where: { unitOfMeasureId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MAKE:
        add(
          'models',
          'Vehicle Models',
          await client.vehicleModel.count({ where: { makeId: id } }),
        );
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({ where: { makeId: id } }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({ where: { makeId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MODEL:
        add(
          'derivatives',
          'Model Derivatives',
          await client.vehicleModelDerivative.count({ where: { modelId: id } }),
        );
        add(
          'generationFamilies',
          'Generation Families',
          await client.vehicleGenerationFamily.count({ where: { modelId: id } }),
        );
        add(
          'generations',
          'Vehicle Generations',
          await client.vehicleGeneration.count({ where: { modelId: id } }),
        );
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({ where: { modelId: id } }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({ where: { modelId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MODEL_DERIVATIVE:
        add(
          'generations',
          'Vehicle Generations',
          await client.vehicleGeneration.count({ where: { derivativeId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY:
        add('generations', 'linked Generations', await client.vehicleGeneration.count({ where: { familyId: id } }));
        break;
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION:
        add(
          'trims',
          'Vehicle Trims',
          await client.vehicleTrim.count({ where: { generationId: id } }),
        );
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({
            where: { generationId: id },
          }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({
            where: { generationId: id },
          }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_TRIM:
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({ where: { trimId: id } }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({ where: { trimId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_ENGINE:
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({ where: { engineId: id } }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({ where: { engineId: id } }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_TRANSMISSION:
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({
            where: { transmissionId: id },
          }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({
            where: { transmissionId: id },
          }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_BODY_TYPE:
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({
            where: { bodyTypeId: id },
          }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({
            where: { bodyTypeId: id },
          }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_MARKET:
        add(
          'configurations',
          'Configured Vehicles',
          await client.vehicleConfiguration.count({ where: { marketId: id } }),
        );
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({ where: { marketId: id } }),
        );
        add(
          'marketApplicabilities',
          'Configured Vehicle market memberships',
          await client.vehicleConfiguration.count({
            where: { marketApplicabilities: { some: { marketId: id } } },
          }),
        );
        break;
      case MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION:
        add(
          'fitments',
          'vehicle fitments',
          await client.vehicleCompatibility.count({
            where: { vehicleConfigurationId: id },
          }),
        );
        add(
          'identifierMappings',
          'identifier mappings',
          await client.vehicleIdentifierMapping.count({
            where: { vehicleConfigurationId: id },
          }),
        );
        add(
          'vehicleProfiles',
          'saved customer Vehicles',
          await client.vehicleProfile.count({
            where: { vehicleConfigurationId: id },
          }),
        );
        break;
      case MasterDataLifecycleEntityType.SUPPLIER:
        add(
          'offers',
          'Supplier Offers',
          await client.supplierOffer.count({ where: { supplierId: id } }),
        );
        break;
    }

    const genericEntityType = this.auditEntityType(entityType);
    add(
      'provenance',
      'provenance records',
      await client.masterDataProvenance.count({
        where: { entityType: genericEntityType, entityId: id },
      }),
    );
    add(
      'localizations',
      'localized records',
      await client.masterDataLocalization.count({
        where: { entityType: genericEntityType, entityId: id },
      }),
    );
    add(
      'externalMappings',
      'external-standard mappings',
      await client.externalStandardMapping.count({
        where: { entityType: genericEntityType, entityId: id },
      }),
    );

    return dependencies;
  }

  private async getRecord(
    client: DatabaseService | Prisma.TransactionClient,
    entityType: MasterDataLifecycleEntityType,
    id: string,
  ): Promise<MasterRecord | null> {
    const select = { id: true, status: true, version: true } as const;

    switch (entityType) {
      case MasterDataLifecycleEntityType.CATEGORY:
        return client.category.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.PRODUCT_FAMILY:
        return client.productFamily.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.PRODUCT_TYPE:
        return client.productType.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.ATTRIBUTE_DEFINITION:
        return client.attributeDefinition.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.ATTRIBUTE_GROUP:
        return client.attributeGroup.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.ATTRIBUTE_ALLOWED_VALUE:
        return client.attributeAllowedValue.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.CRITERIA_TEMPLATE:
        return client.productTypeCriteriaTemplate.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.BRAND:
        return client.brand.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.UNIT_OF_MEASURE:
        return client.unitOfMeasure.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_MAKE:
        return client.vehicleMake.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_MODEL:
        return client.vehicleModel.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_MODEL_DERIVATIVE:
        return client.vehicleModelDerivative.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY:
        return client.vehicleGenerationFamily.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION:
        return client.vehicleGeneration.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_TRIM:
        return client.vehicleTrim.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_ENGINE:
        return client.vehicleEngine.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_TRANSMISSION:
        return client.vehicleTransmission.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_BODY_TYPE:
        return client.vehicleBodyType.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_MARKET:
        return client.vehicleMarket.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION:
        return client.vehicleConfiguration.findUnique({ where: { id }, select });
      case MasterDataLifecycleEntityType.SUPPLIER:
        return client.supplier.findUnique({ where: { id }, select });
    }
  }

  private async updateRecord(
    tx: Prisma.TransactionClient,
    entityType: MasterDataLifecycleEntityType,
    id: string,
    version: number,
    status: MasterDataStatus,
    actorId: string,
  ): Promise<MasterRecord> {
    const data = {
      status,
      version: { increment: 1 },
      updatedById: actorId,
    } as const;
    const where = { id, version };
    const select = { id: true, status: true, version: true } as const;

    const updateCount = async (): Promise<number> => {
      switch (entityType) {
        case MasterDataLifecycleEntityType.CATEGORY:
          return (await tx.category.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.PRODUCT_FAMILY:
          return (await tx.productFamily.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.PRODUCT_TYPE:
          return (await tx.productType.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.ATTRIBUTE_DEFINITION:
          return (await tx.attributeDefinition.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.ATTRIBUTE_GROUP:
          return (await tx.attributeGroup.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.ATTRIBUTE_ALLOWED_VALUE:
          return (await tx.attributeAllowedValue.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.CRITERIA_TEMPLATE:
          return (await tx.productTypeCriteriaTemplate.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.BRAND:
          return (await tx.brand.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.UNIT_OF_MEASURE:
          return (await tx.unitOfMeasure.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_MAKE:
          return (await tx.vehicleMake.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_MODEL:
          return (await tx.vehicleModel.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_MODEL_DERIVATIVE:
          return (await tx.vehicleModelDerivative.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY:
          return (await tx.vehicleGenerationFamily.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_GENERATION:
          return (await tx.vehicleGeneration.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_TRIM:
          return (await tx.vehicleTrim.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_ENGINE:
          return (await tx.vehicleEngine.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_TRANSMISSION:
          return (await tx.vehicleTransmission.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_BODY_TYPE:
          return (await tx.vehicleBodyType.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_MARKET:
          return (await tx.vehicleMarket.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION:
          return (await tx.vehicleConfiguration.updateMany({ where, data })).count;
        case MasterDataLifecycleEntityType.SUPPLIER:
          return (await tx.supplier.updateMany({ where, data })).count;
      }
    };

    if ((await updateCount()) !== 1) {
      throw this.versionConflict(entityType);
    }

    const updated = await this.getRecord(tx, entityType, id);
    if (!updated) throw this.notFound(entityType);
    return updated;
  }

  private async deleteRecord(
    tx: Prisma.TransactionClient,
    entityType: MasterDataLifecycleEntityType,
    id: string,
    version: number,
  ): Promise<number> {
    const where = { id, version };
    switch (entityType) {
      case MasterDataLifecycleEntityType.CATEGORY:
        return (await tx.category.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.PRODUCT_FAMILY:
        return (await tx.productFamily.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.PRODUCT_TYPE:
        return (await tx.productType.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.ATTRIBUTE_DEFINITION:
        return (await tx.attributeDefinition.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.ATTRIBUTE_GROUP:
        return (await tx.attributeGroup.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.ATTRIBUTE_ALLOWED_VALUE:
        return (await tx.attributeAllowedValue.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.CRITERIA_TEMPLATE:
        return (await tx.productTypeCriteriaTemplate.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.BRAND:
        return (await tx.brand.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.UNIT_OF_MEASURE:
        return (await tx.unitOfMeasure.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_MAKE:
        return (await tx.vehicleMake.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_MODEL:
        return (await tx.vehicleModel.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_MODEL_DERIVATIVE:
        return (await tx.vehicleModelDerivative.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY:
        return (await tx.vehicleGenerationFamily.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION:
        return (await tx.vehicleGeneration.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_TRIM:
        return (await tx.vehicleTrim.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_ENGINE:
        return (await tx.vehicleEngine.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_TRANSMISSION:
        return (await tx.vehicleTransmission.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_BODY_TYPE:
        return (await tx.vehicleBodyType.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_MARKET:
        return (await tx.vehicleMarket.deleteMany({ where })).count;
      case MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION:
        return 0;
      case MasterDataLifecycleEntityType.SUPPLIER:
        return (await tx.supplier.deleteMany({ where })).count;
    }
  }

  private auditEntityType(
    entityType: MasterDataLifecycleEntityType,
  ): string {
    switch (entityType) {
      case MasterDataLifecycleEntityType.CATEGORY:
        return 'Category';
      case MasterDataLifecycleEntityType.PRODUCT_FAMILY:
        return 'ProductFamily';
      case MasterDataLifecycleEntityType.PRODUCT_TYPE:
        return 'ProductType';
      case MasterDataLifecycleEntityType.ATTRIBUTE_DEFINITION:
        return 'AttributeDefinition';
      case MasterDataLifecycleEntityType.ATTRIBUTE_GROUP:
        return 'AttributeGroup';
      case MasterDataLifecycleEntityType.ATTRIBUTE_ALLOWED_VALUE:
        return 'AttributeAllowedValue';
      case MasterDataLifecycleEntityType.CRITERIA_TEMPLATE:
        return 'ProductTypeCriteriaTemplate';
      case MasterDataLifecycleEntityType.BRAND:
        return 'Brand';
      case MasterDataLifecycleEntityType.UNIT_OF_MEASURE:
        return 'UnitOfMeasure';
      case MasterDataLifecycleEntityType.VEHICLE_MAKE:
        return 'VehicleMake';
      case MasterDataLifecycleEntityType.VEHICLE_MODEL:
        return 'VehicleModel';
      case MasterDataLifecycleEntityType.VEHICLE_MODEL_DERIVATIVE:
        return 'VehicleModelDerivative';
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION_FAMILY:
        return 'VehicleGenerationFamily';
      case MasterDataLifecycleEntityType.VEHICLE_GENERATION:
        return 'VehicleGeneration';
      case MasterDataLifecycleEntityType.VEHICLE_TRIM:
        return 'VehicleTrim';
      case MasterDataLifecycleEntityType.VEHICLE_ENGINE:
        return 'VehicleEngine';
      case MasterDataLifecycleEntityType.VEHICLE_TRANSMISSION:
        return 'VehicleTransmission';
      case MasterDataLifecycleEntityType.VEHICLE_BODY_TYPE:
        return 'VehicleBodyType';
      case MasterDataLifecycleEntityType.VEHICLE_MARKET:
        return 'VehicleMarket';
      case MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION:
        return 'VehicleConfiguration';
      case MasterDataLifecycleEntityType.SUPPLIER:
        return 'Supplier';
    }
  }

  private record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private notFound(
    entityType: MasterDataLifecycleEntityType,
  ): NotFoundException {
    return new NotFoundException({
      code: 'MASTER_DATA_LIFECYCLE_ENTITY_NOT_FOUND',
      message: `${entityType} master record was not found.`,
    });
  }

  private versionConflict(
    entityType: MasterDataLifecycleEntityType,
  ): ConflictException {
    return new ConflictException({
      code: 'MASTER_DATA_LIFECYCLE_VERSION_CONFLICT',
      message: `${entityType} changed since it was loaded.`,
    });
  }

  private rethrowPersistence(
    error: unknown,
    entityType: MasterDataLifecycleEntityType,
  ): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034') {
        throw this.versionConflict(entityType);
      }
      if (error.code === 'P2003') {
        throw new ConflictException({
          code: 'MASTER_DATA_DEPENDENCY_CONFLICT',
          message:
            'A dependent record changed while this lifecycle operation was running. Refresh the removal preflight and try again.',
        });
      }
    }

    throw error;
  }
}
