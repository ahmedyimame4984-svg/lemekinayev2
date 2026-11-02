import { Injectable, Logger } from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  Prisma,
  ProductTypeAttributeAssignmentOrigin,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
  VehicleBodyType,
  VehicleEnergyStorageRole,
  VehicleExternalChargingCapability,
  VehicleMarketKind,
  VehiclePowertrainType,
  VehicleProductionEndStatus,
  VehiclePropulsionTopology,
  VehicleSteeringSide,
} from '@prisma/client';
import { CanonicalSyncEntityType } from './reference-sync.types.js';

export const SYSTEM_SYNC_USER_EMAIL = 'system-sync@lemekinaye.internal';

@Injectable()
export class ReferenceDataUpserter {
  private readonly logger = new Logger(ReferenceDataUpserter.name);
  private cachedActorId: string | null = null;

  async resolveActorId(tx: Prisma.TransactionClient): Promise<string> {
    if (this.cachedActorId) {
      const exists = await tx.user.findUnique({
        where: { id: this.cachedActorId },
        select: { id: true },
      });
      if (exists) return this.cachedActorId;
    }

    const systemUser = await tx.user.findFirst({
      where: { email: SYSTEM_SYNC_USER_EMAIL },
      select: { id: true },
    });
    if (systemUser) {
      this.cachedActorId = systemUser.id;
      return systemUser.id;
    }

    const admin = await tx.user.findFirst({
      where: { accountType: AccountType.ADMIN },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (admin) {
      this.cachedActorId = admin.id;
      return admin.id;
    }

    const created = await tx.user.create({
      data: {
        email: SYSTEM_SYNC_USER_EMAIL,
        name: 'Reference Data Sync Engine',
        accountType: AccountType.ADMIN,
        status: AccountStatus.ACTIVE,
      },
      select: { id: true },
    });
    this.cachedActorId = created.id;
    return created.id;
  }

  async upsertRecord(
    tx: Prisma.TransactionClient,
    entityType: CanonicalSyncEntityType,
    record: Record<string, any>,
  ): Promise<'APPLIED' | 'SKIPPED'> {
    const actorId = await this.resolveActorId(tx);

    switch (entityType) {
      case 'Brand': {
        await tx.brand.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'Category': {
        await tx.category.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            parentId: record.parentId ?? null,
            code: record.code,
            name: record.name,
            slug: record.slug,
            description: record.description ?? null,
            sortOrder: record.sortOrder ?? 0,
            level: record.level ?? 1,
            isLeaf: record.isLeaf ?? true,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            parentId: record.parentId ?? null,
            code: record.code,
            name: record.name,
            slug: record.slug,
            description: record.description ?? null,
            sortOrder: record.sortOrder ?? 0,
            level: record.level ?? 1,
            isLeaf: record.isLeaf ?? true,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'ProductFamily': {
        await tx.productFamily.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            categoryId: record.categoryId,
            code: record.code,
            name: record.name,
            description: record.description ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            categoryId: record.categoryId,
            code: record.code,
            name: record.name,
            description: record.description ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'AttributeGroup': {
        await tx.attributeGroup.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            code: record.code,
            name: record.name,
            description: record.description ?? null,
            sortOrder: record.sortOrder ?? 0,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            code: record.code,
            name: record.name,
            description: record.description ?? null,
            sortOrder: record.sortOrder ?? 0,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'AttributeUnit': {
        if (record.dimensionId) {
          const dim = await tx.unitDimension.findUnique({
            where: { id: record.dimensionId },
            select: { id: true },
          });
          if (!dim) {
            await tx.unitDimension.create({
              data: {
                id: record.dimensionId,
                code: `DIM_${record.dimensionId.slice(0, 8).toUpperCase()}`,
                name: `Dimension for ${record.code}`,
                status: MasterDataStatus.ACTIVE,
                createdById: actorId,
                updatedById: actorId,
              },
            });
          }
        }

        await tx.attributeUnit.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            dimensionId: record.dimensionId,
            code: record.code,
            name: record.name,
            symbol: record.symbol,
            isBase: record.isBase ?? false,
            factorToBase: record.factorToBase ?? 1,
            offsetToBase: record.offsetToBase ?? 0,
            sortOrder: record.sortOrder ?? 0,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            dimensionId: record.dimensionId,
            code: record.code,
            name: record.name,
            symbol: record.symbol,
            isBase: record.isBase ?? false,
            factorToBase: record.factorToBase ?? 1,
            offsetToBase: record.offsetToBase ?? 0,
            sortOrder: record.sortOrder ?? 0,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'AttributeDefinition': {
        await tx.attributeDefinition.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            groupId: record.groupId ?? null,
            optionSetId: record.optionSetId ?? null,
            unitDimensionId: record.unitDimensionId ?? null,
            defaultUnitId: record.defaultUnitId ?? null,
            code: record.code,
            name: record.name,
            dataType: (record.dataType as AttributeDataType) ?? AttributeDataType.TEXT,
            scope: (record.scope as AttributeScope) ?? AttributeScope.PRODUCT,
            valueSource: (record.valueSource as AttributeValueSource) ?? AttributeValueSource.NONE,
            unit: record.unit ?? null,
            description: record.description ?? null,
            exampleValue: record.exampleValue ?? null,
            validationRule: record.validationRule ?? undefined,
            repeatable: record.repeatable ?? false,
            translatable: record.translatable ?? false,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            groupId: record.groupId ?? null,
            optionSetId: record.optionSetId ?? null,
            unitDimensionId: record.unitDimensionId ?? null,
            defaultUnitId: record.defaultUnitId ?? null,
            code: record.code,
            name: record.name,
            dataType: (record.dataType as AttributeDataType) ?? AttributeDataType.TEXT,
            scope: (record.scope as AttributeScope) ?? AttributeScope.PRODUCT,
            valueSource: (record.valueSource as AttributeValueSource) ?? AttributeValueSource.NONE,
            unit: record.unit ?? null,
            description: record.description ?? null,
            exampleValue: record.exampleValue ?? null,
            validationRule: record.validationRule ?? undefined,
            repeatable: record.repeatable ?? false,
            translatable: record.translatable ?? false,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'AttributeAllowedValue': {
        await tx.attributeAllowedValue.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            attributeId: record.attributeId,
            code: record.code,
            label: record.label,
            description: record.description ?? null,
            sortOrder: record.sortOrder ?? 0,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            attributeId: record.attributeId,
            code: record.code,
            label: record.label,
            description: record.description ?? null,
            sortOrder: record.sortOrder ?? 0,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'ProductType': {
        const existing = await tx.productType.findUnique({
          where: { id: record.id },
        });

        if (existing) {
          // SAFE UPDATE: Update canonical fields only.
          // PRESERVE marketplace commercial requirements: brandRequirement, priceRequirement,
          // stockRequirement, imageRequirement, minimumImageCount, maximumImageCount, etc.
          await tx.productType.update({
            where: { id: record.id },
            data: {
              categoryId: record.categoryId ?? existing.categoryId,
              productFamilyId: record.productFamilyId ?? existing.productFamilyId,
              parentId: record.parentId ?? existing.parentId,
              code: record.code ?? existing.code,
              name: record.name ?? existing.name,
              slug: record.slug ?? existing.slug,
              description: record.description ?? existing.description,
              sortOrder: record.sortOrder ?? existing.sortOrder,
              status: (record.status as MasterDataStatus) ?? existing.status,
              version: record.version ?? existing.version + 1,
              updatedById: actorId,
            },
          });
        } else {
          // Fresh insert
          await tx.productType.create({
            data: {
              id: record.id,
              categoryId: record.categoryId,
              productFamilyId: record.productFamilyId ?? null,
              parentId: record.parentId ?? null,
              code: record.code,
              name: record.name,
              slug: record.slug,
              description: record.description ?? null,
              sortOrder: record.sortOrder ?? 0,
              brandRequirement:
                ProductTypeRequirementLevel.OPTIONAL,
              identifierRequirement:
                ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
              gtinRequirement:
                ProductTypeRequirementLevel.OPTIONAL,
              oemReferenceRequirement:
                ProductTypeRequirementLevel.OPTIONAL,
              crossReferenceRequirement:
                ProductTypeRequirementLevel.OPTIONAL,
              fitmentRequirement:
                ProductTypeRequirementLevel.REQUIRED,
              imageRequirement:
                ProductTypeRequirementLevel.REQUIRED,
              minimumImageCount: 1,
              maximumImageCount: 20,
              documentRequirement:
                ProductTypeRequirementLevel.OPTIONAL,
              minimumDocumentCount: 0,
              priceRequirement:
                ProductTypeRequirementLevel.REQUIRED,
              stockRequirement:
                ProductTypeRequirementLevel.REQUIRED,
              conditionRequirement:
                ProductTypeRequirementLevel.REQUIRED,
              warrantyRequirement:
                ProductTypeRequirementLevel.OPTIONAL,
              status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
              version: record.version ?? 1,
              createdById: actorId,
              updatedById: actorId,
            },
          });
        }
        return 'APPLIED';
      }

      case 'ProductTypeAttributeAssignment': {
        const existing = await tx.productTypeAttributeAssignment.findUnique({
          where: {
            productTypeId_attributeId: {
              productTypeId: record.productTypeId,
              attributeId: record.attributeId,
            },
          },
        });

        if (existing) {
          // NON-NEGOTIABLE REQUIREMENT:
          // Preserve consumer-owned customizations (requirement, displayMode, validationRule,
          // conditionalRule, searchable, filterable, comparable, variantDefining, marketplaceVisible, sellerEditable).
          // Only update canonical displayOrder, defaultUnitId, origin, status, and version.
          await tx.productTypeAttributeAssignment.update({
            where: { id: existing.id },
            data: {
              displayOrder: record.displayOrder ?? existing.displayOrder,
              defaultUnitId: record.defaultUnitId ?? existing.defaultUnitId,
              origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
              status: (record.status as MasterDataStatus) ?? existing.status,
              version: record.version ?? existing.version + 1,
              updatedById: actorId,
            },
          });
        } else {
          // Fresh insert from canonical master
          await tx.productTypeAttributeAssignment.create({
            data: {
              id: record.id,
              productTypeId: record.productTypeId,
              attributeId: record.attributeId,
              displayOrder: record.displayOrder ?? 0,
              defaultUnitId: record.defaultUnitId ?? null,
              requirement:
                (record.requirement as ProductTypeAttributeRequirement) ??
                ProductTypeAttributeRequirement.OPTIONAL,
              displayMode:
                (record.displayMode as ProductTypeAttributeDisplayMode) ??
                ProductTypeAttributeDisplayMode.VISIBLE,
              validationRule: undefined,
              conditionalRule: undefined,
              searchable: record.searchable ?? false,
              filterable: record.filterable ?? false,
              comparable: record.comparable ?? false,
              variantDefining: record.variantDefining ?? false,
              marketplaceVisible: record.marketplaceVisible ?? true,
              sellerEditable: record.sellerEditable ?? true,
              origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
              status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
              version: record.version ?? 1,
              createdById: actorId,
              updatedById: actorId,
            },
          });
        }
        return 'APPLIED';
      }

      case 'ProductTypeSchemaVersion': {
        await tx.productTypeSchemaVersion.upsert({
          where: {
            productTypeId_schemaVersion: {
              productTypeId: record.productTypeId,
              schemaVersion: record.schemaVersion,
            },
          },
          create: {
            id: record.id,
            productTypeId: record.productTypeId,
            schemaVersion: record.schemaVersion,
            schemaHash: record.schemaHash,
            snapshot: record.snapshot,
            publishedById: actorId,
            publishedAt: record.publishedAt ? new Date(record.publishedAt) : new Date(),
          },
          update: {
            schemaHash: record.schemaHash,
            snapshot: record.snapshot,
            publishedById: actorId,
            publishedAt: record.publishedAt ? new Date(record.publishedAt) : new Date(),
          },
        });
        return 'APPLIED';
      }

      case 'VehicleMake': {
        await tx.vehicleMake.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleModel': {
        await tx.vehicleModel.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            makeId: record.makeId,
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            makeId: record.makeId,
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleGenerationFamily': {
        await tx.vehicleGenerationFamily.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            modelId: record.modelId,
            code: record.code,
            name: record.name,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            endStatus:
              (record.endStatus as VehicleProductionEndStatus) ??
              VehicleProductionEndStatus.UNKNOWN,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            modelId: record.modelId,
            code: record.code,
            name: record.name,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            endStatus:
              (record.endStatus as VehicleProductionEndStatus) ??
              VehicleProductionEndStatus.UNKNOWN,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleGeneration': {
        await tx.vehicleGeneration.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            modelId: record.modelId,
            familyId: record.familyId ?? null,
            derivativeId: record.derivativeId ?? null,
            code: record.code ?? null,
            name: record.name,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            endStatus:
              (record.endStatus as VehicleProductionEndStatus) ??
              VehicleProductionEndStatus.UNKNOWN,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            modelId: record.modelId,
            familyId: record.familyId ?? null,
            derivativeId: record.derivativeId ?? null,
            code: record.code ?? null,
            name: record.name,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            endStatus:
              (record.endStatus as VehicleProductionEndStatus) ??
              VehicleProductionEndStatus.UNKNOWN,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleTrim': {
        await tx.vehicleTrim.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            generationId: record.generationId,
            code: record.code ?? null,
            name: record.name,
            equipmentLevel: record.equipmentLevel ?? null,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            generationId: record.generationId,
            code: record.code ?? null,
            name: record.name,
            equipmentLevel: record.equipmentLevel ?? null,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleEngine': {
        await tx.vehicleEngine.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            code: record.code ?? null,
            name: record.name,
            family: record.family ?? null,
            displacementCc: record.displacementCc ?? null,
            fuelType: record.fuelType ?? null,
            cylinderCount: record.cylinderCount ?? null,
            aspiration: record.aspiration ?? null,
            powerKw: record.powerKw != null ? record.powerKw : null,
            torqueNm: record.torqueNm != null ? record.torqueNm : null,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            code: record.code ?? null,
            name: record.name,
            family: record.family ?? null,
            displacementCc: record.displacementCc ?? null,
            fuelType: record.fuelType ?? null,
            cylinderCount: record.cylinderCount ?? null,
            aspiration: record.aspiration ?? null,
            powerKw: record.powerKw != null ? record.powerKw : null,
            torqueNm: record.torqueNm != null ? record.torqueNm : null,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleTransmission': {
        await tx.vehicleTransmission.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            code: record.code ?? null,
            transmissionType: record.transmissionType,
            gearCount: record.gearCount ?? null,
            driveType: record.driveType ?? null,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            code: record.code ?? null,
            transmissionType: record.transmissionType,
            gearCount: record.gearCount ?? null,
            driveType: record.driveType ?? null,
            startYear: record.startYear ?? null,
            endYear: record.endYear ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleBodyType': {
        await tx.vehicleBodyType.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            code: record.code,
            name: record.name,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleMarket': {
        await tx.vehicleMarket.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            code: record.code,
            name: record.name,
            kind: (record.kind as VehicleMarketKind) ?? null,
            countryCode: record.countryCode ?? null,
            regionCode: record.regionCode ?? null,
            specificationReference: record.specificationReference ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            code: record.code,
            name: record.name,
            kind: (record.kind as VehicleMarketKind) ?? null,
            countryCode: record.countryCode ?? null,
            regionCode: record.regionCode ?? null,
            specificationReference: record.specificationReference ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      case 'VehicleConfiguration': {
        await tx.vehicleConfiguration.upsert({
          where: { id: record.id },
          create: {
            id: record.id,
            identityCode: record.identityCode,
            code: record.code ?? null,
            makeId: record.makeId,
            modelId: record.modelId,
            generationId: record.generationId ?? null,
            trimId: record.trimId ?? null,
            engineId: record.engineId ?? null,
            transmissionId: record.transmissionId ?? null,
            powertrainType: (record.powertrainType as VehiclePowertrainType) ?? null,
            propulsionTopology: (record.propulsionTopology as VehiclePropulsionTopology) ?? null,
            energyStorageRole: (record.energyStorageRole as VehicleEnergyStorageRole) ?? null,
            externalChargingCapability:
              (record.externalChargingCapability as VehicleExternalChargingCapability) ?? null,
            bodyTypeId: record.bodyTypeId ?? null,
            marketId: record.marketId ?? null,
            driveType: record.driveType ?? null,
            materialMarketVariant: record.materialMarketVariant ?? null,
            modelYear: record.modelYear ?? null,
            productionStartYear: record.productionStartYear ?? null,
            productionStartMonth: record.productionStartMonth ?? null,
            productionEndYear: record.productionEndYear ?? null,
            productionEndMonth: record.productionEndMonth ?? null,
            productionEndStatus:
              (record.productionEndStatus as VehicleProductionEndStatus) ??
              VehicleProductionEndStatus.UNKNOWN,
            steeringSide: (record.steeringSide as VehicleSteeringSide) ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? 1,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            identityCode: record.identityCode,
            code: record.code ?? null,
            makeId: record.makeId,
            modelId: record.modelId,
            generationId: record.generationId ?? null,
            trimId: record.trimId ?? null,
            engineId: record.engineId ?? null,
            transmissionId: record.transmissionId ?? null,
            powertrainType: (record.powertrainType as VehiclePowertrainType) ?? null,
            propulsionTopology: (record.propulsionTopology as VehiclePropulsionTopology) ?? null,
            energyStorageRole: (record.energyStorageRole as VehicleEnergyStorageRole) ?? null,
            externalChargingCapability:
              (record.externalChargingCapability as VehicleExternalChargingCapability) ?? null,
            bodyTypeId: record.bodyTypeId ?? null,
            marketId: record.marketId ?? null,
            driveType: record.driveType ?? null,
            materialMarketVariant: record.materialMarketVariant ?? null,
            modelYear: record.modelYear ?? null,
            productionStartYear: record.productionStartYear ?? null,
            productionStartMonth: record.productionStartMonth ?? null,
            productionEndYear: record.productionEndYear ?? null,
            productionEndMonth: record.productionEndMonth ?? null,
            productionEndStatus:
              (record.productionEndStatus as VehicleProductionEndStatus) ??
              VehicleProductionEndStatus.UNKNOWN,
            steeringSide: (record.steeringSide as VehicleSteeringSide) ?? null,
            status: (record.status as MasterDataStatus) ?? MasterDataStatus.ACTIVE,
            version: record.version ?? undefined,
            updatedById: actorId,
          },
        });
        return 'APPLIED';
      }

      default:
        this.logger.warn(`Unknown sync entity type ${entityType}, skipping`);
        return 'SKIPPED';
    }
  }

  async archiveRecord(
    tx: Prisma.TransactionClient,
    entityType: CanonicalSyncEntityType,
    id: string,
  ): Promise<void> {
    const actorId = await this.resolveActorId(tx);

    switch (entityType) {
      case 'Brand':
        await tx.brand.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'Category':
        await tx.category.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'ProductFamily':
        await tx.productFamily.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'AttributeGroup':
        await tx.attributeGroup.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'AttributeUnit':
        await tx.attributeUnit.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'AttributeDefinition':
        await tx.attributeDefinition.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'AttributeAllowedValue':
        await tx.attributeAllowedValue.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'ProductType':
        await tx.productType.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'ProductTypeAttributeAssignment':
        await tx.productTypeAttributeAssignment.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleMake':
        await tx.vehicleMake.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleModel':
        await tx.vehicleModel.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleGenerationFamily':
        await tx.vehicleGenerationFamily.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleGeneration':
        await tx.vehicleGeneration.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleTrim':
        await tx.vehicleTrim.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleEngine':
        await tx.vehicleEngine.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleTransmission':
        await tx.vehicleTransmission.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleBodyType':
        await tx.vehicleBodyType.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleMarket':
        await tx.vehicleMarket.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      case 'VehicleConfiguration':
        await tx.vehicleConfiguration.updateMany({
          where: { id },
          data: { status: MasterDataStatus.ARCHIVED, updatedById: actorId },
        });
        break;
      default:
        break;
    }
  }
}
