import { ConflictException, Injectable } from '@nestjs/common';
import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  Prisma,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import {
  LEGACY_SEEDED_CATEGORY_CODES,
  LEGACY_SEEDED_PRODUCT_TYPE_CODES,
  MASTER_REFERENCE_DATA as data,
  validateMasterAttributeLibrary,
} from '../scripts/master-reference-data.js';

export interface AttributeMasterInstallResult {
  attributeGroups: number;
  unitDimensions: number;
  attributeUnits: number;
  optionSets: number;
  optionValues: number;
  attributes: number;
  attributeAliases: number;
  allowedValues: number;
}

export interface CanonicalAttributeMasterStatus {
  valid: boolean;
  validationErrors: string[];
  ready: boolean;
  expected: AttributeMasterInstallResult;
}

export interface MasterReferenceInstallResult {
  attributeGroups: number;
  unitDimensions: number;
  attributeUnits: number;
  optionSets: number;
  optionValues: number;
  attributes: number;
  attributeAliases: number;
  allowedValues: number;
  rootCategories: number;
  subcategories: number;
  categories: number;
  parentProductTypes: number;
  childProductTypes: number;
  productTypes: number;
  attributeAssignments: number;
  publishedSchemas: number;
  vehicleMakes: number;
  vehicleModels: number;
  vehicleDerivatives: number;
  vehicleGenerations: number;
  vehicleTrims: number;
  vehicleConfigurations: number;
}

export interface MasterReferenceStatusCount {
  actual: number;
  // Only the canonical Attribute baseline has prescribed counts.
  // Admin-managed Catalog and Vehicle records have no fixed target.
  expected: number | null;
}

export interface MasterReferenceStatus {
  // Backward-compatible Attribute baseline readiness; NOT vehicle certification.
  ready: boolean;
  attributeLibraryReady: boolean;
  vehicleLibraryState: 'EMPTY' | 'MASTERS_ONLY' | 'CONFIGURATIONS_PRESENT';
  catalogManagedByAdmin: boolean;
  replacementInProgress: boolean;
  counts: {
    attributeGroups: MasterReferenceStatusCount;
    unitDimensions: MasterReferenceStatusCount;
    attributeUnits: MasterReferenceStatusCount;
    optionSets: MasterReferenceStatusCount;
    optionValues: MasterReferenceStatusCount;
    attributes: MasterReferenceStatusCount;
    attributeAliases: MasterReferenceStatusCount;
    allowedValues: MasterReferenceStatusCount;
    rootCategories: MasterReferenceStatusCount;
    subcategories: MasterReferenceStatusCount;
    categories: MasterReferenceStatusCount;
    parentProductTypes: MasterReferenceStatusCount;
    childProductTypes: MasterReferenceStatusCount;
    productTypes: MasterReferenceStatusCount;
    vehicleMakes: MasterReferenceStatusCount;
    vehicleModels: MasterReferenceStatusCount;
    vehicleDerivatives: MasterReferenceStatusCount;
    vehicleGenerations: MasterReferenceStatusCount;
    vehicleTrims: MasterReferenceStatusCount;
    vehicleEngines: MasterReferenceStatusCount;
    vehicleTransmissions: MasterReferenceStatusCount;
    vehicleBodyTypes: MasterReferenceStatusCount;
    vehicleMarkets: MasterReferenceStatusCount;
    vehicleConfigurations: MasterReferenceStatusCount;
  };
  blockers: {
    products: number;
    sellerListings: number;
    vehicleProfiles: number;
    vehicleCompatibilities: number;
  };
}

export const MASTER_REFERENCE_AUTO_BOOTSTRAP_ACTION =
  'MASTER_REFERENCE_DATA_AUTO_BOOTSTRAPPED_V6_ATTRIBUTE_V2';

type AttributeReconcileClient = Pick<
  Prisma.TransactionClient,
  | 'attributeGroup'
  | 'unitDimension'
  | 'attributeUnit'
  | 'attributeOptionSet'
  | 'attributeOptionValue'
  | 'attributeDefinition'
  | 'attributeAlias'
  | 'attributeAllowedValue'
>;

@Injectable()
export class MasterReferenceService {
  private replacementInProgress = false;

  constructor(private readonly db: DatabaseService) {}

  async canonicalAttributeStatus(): Promise<CanonicalAttributeMasterStatus> {
    const validationErrors = validateMasterAttributeLibrary();
    const valid = validationErrors.length === 0;

    return {
      valid,
      validationErrors,
      ready: valid && (await this.hasCanonicalAttributeLibrary()),
      expected: this.attributeMasterExpectedCounts(),
    };
  }

  async status(): Promise<MasterReferenceStatus> {
    // Status is read-only. Never compare an Admin-managed vehicle library to
    // historical seed counts or fetch entire vehicle tables for a dashboard.
    const [
      attributeGroups,
      unitDimensions,
      attributeUnits,
      optionSets,
      optionValues,
      attributes,
      attributeAliases,
      allowedValues,
      rootCategories,
      categories,
      parentProductTypes,
      productTypes,
      vehicleMakes,
      vehicleModels,
      vehicleDerivatives,
      vehicleGenerations,
      vehicleTrims,
      vehicleEngines,
      vehicleTransmissions,
      vehicleBodyTypes,
      vehicleMarkets,
      vehicleConfigurations,
      products,
      sellerListings,
      vehicleProfiles,
      vehicleCompatibilities,
      attributeStatus,
    ] = await Promise.all([
      this.db.attributeGroup.count(),
      this.db.unitDimension.count(),
      this.db.attributeUnit.count(),
      this.db.attributeOptionSet.count(),
      this.db.attributeOptionValue.count(),
      this.db.attributeDefinition.count(),
      this.db.attributeAlias.count(),
      this.db.attributeAllowedValue.count(),
      this.db.category.count({ where: { parentId: null } }),
      this.db.category.count(),
      this.db.productType.count({ where: { parentId: null } }),
      this.db.productType.count(),
      this.db.vehicleMake.count(),
      this.db.vehicleModel.count(),
      this.db.vehicleModelDerivative.count(),
      this.db.vehicleGeneration.count(),
      this.db.vehicleTrim.count(),
      this.db.vehicleEngine.count(),
      this.db.vehicleTransmission.count(),
      this.db.vehicleBodyType.count(),
      this.db.vehicleMarket.count(),
      this.db.vehicleConfiguration.count(),
      this.db.product.count(),
      this.db.sellerListing.count(),
      this.db.vehicleProfile.count(),
      this.db.vehicleCompatibility.count(),
      this.canonicalAttributeStatus(),
    ]);

    const expected: Record<keyof MasterReferenceStatus['counts'], number | null> = {
      attributeGroups: data.attributeGroups.length,
      unitDimensions: data.unitDimensions.length,
      attributeUnits: data.unitDimensions.reduce(
        (total, dimension) => total + dimension.units.length,
        0,
      ),
      optionSets: data.optionSets.length,
      optionValues: data.optionSets.reduce(
        (total, optionSet) => total + optionSet.values.length,
        0,
      ),
      attributes: data.attributes.length,
      attributeAliases: data.attributes.reduce(
        (total, attribute) => total + attribute.aliases.length,
        0,
      ),
      allowedValues: data.allowedValues.length,
      rootCategories: null,
      subcategories: null,
      categories: null,
      parentProductTypes: null,
      childProductTypes: null,
      productTypes: null,
      vehicleMakes: null,
      vehicleModels: null,
      vehicleDerivatives: null,
      vehicleGenerations: null,
      vehicleTrims: null,
      vehicleEngines: null,
      vehicleTransmissions: null,
      vehicleBodyTypes: null,
      vehicleMarkets: null,
      vehicleConfigurations: null,
    };

    const actual = {
      attributeGroups,
      unitDimensions,
      attributeUnits,
      optionSets,
      optionValues,
      attributes,
      attributeAliases,
      allowedValues,
      rootCategories,
      subcategories: categories - rootCategories,
      categories,
      parentProductTypes,
      childProductTypes: productTypes - parentProductTypes,
      productTypes,
      vehicleMakes,
      vehicleModels,
      vehicleDerivatives,
      vehicleGenerations,
      vehicleTrims,
      vehicleEngines,
      vehicleTransmissions,
      vehicleBodyTypes,
      vehicleMarkets,
      vehicleConfigurations,
    };

    const counts = Object.fromEntries(
      Object.entries(expected).map(([key, expectedValue]) => [
        key,
        {
          actual: actual[key as keyof typeof actual],
          expected: expectedValue,
        },
      ]),
    ) as MasterReferenceStatus['counts'];

    const totalVehicleMasters =
      vehicleMakes + vehicleModels + vehicleDerivatives + vehicleGenerations +
      vehicleTrims + vehicleEngines + vehicleTransmissions + vehicleBodyTypes + vehicleMarkets;
    const vehicleLibraryState = vehicleConfigurations > 0
      ? 'CONFIGURATIONS_PRESENT'
      : totalVehicleMasters > 0
        ? 'MASTERS_ONLY'
        : 'EMPTY';

    return {
      // No overall vehicle quality claim: readiness is limited to Attributes.
      ready: attributeStatus.ready,
      attributeLibraryReady: attributeStatus.ready,
      vehicleLibraryState,
      catalogManagedByAdmin: true,
      replacementInProgress: this.replacementInProgress,
      counts,
      blockers: {
        products,
        sellerListings,
        vehicleProfiles,
        vehicleCompatibilities,
      },
    };
  }

  private async hasCanonicalAttributeLibrary(): Promise<boolean> {
    const groupCodes = data.attributeGroups.map((item) => item.code);
    const dimensionCodes = data.unitDimensions.map((item) => item.code);
    const unitCodes = data.unitDimensions.flatMap((dimension) =>
      dimension.units.map((unit) => unit.code),
    );
    const optionSetCodes = data.optionSets.map((item) => item.code);
    const attributeCodes = data.attributes.map((item) => item.code);
    const optionValueSelectors = data.optionSets.flatMap((optionSet) =>
      optionSet.values.map((value) => ({
        optionSet: { code: optionSet.code },
        code: value.code,
        status: MasterDataStatus.ACTIVE,
      })),
    );
    const aliasSelectors = data.attributes.flatMap((attribute) =>
      attribute.aliases.map((alias) => ({
        attribute: { code: attribute.code },
        normalizedAlias: this.normalizeAttributeAlias(alias.alias),
        locale: alias.locale,
        status: MasterDataStatus.ACTIVE,
      })),
    );
    const allowedValueSelectors = data.allowedValues.map((value) => ({
      attribute: { code: value.attributeCode },
      code: value.code,
      status: MasterDataStatus.ACTIVE,
    }));

    const [
      attributeGroups,
      unitDimensions,
      attributeUnits,
      optionSets,
      optionValues,
      attributes,
      attributeAliases,
      allowedValues,
    ] = await Promise.all([
      this.db.attributeGroup.count({
        where: {
          code: { in: groupCodes },
          status: MasterDataStatus.ACTIVE,
        },
      }),
      this.db.unitDimension.count({
        where: {
          code: { in: dimensionCodes },
          status: MasterDataStatus.ACTIVE,
        },
      }),
      this.db.attributeUnit.count({
        where: {
          code: { in: unitCodes },
          status: MasterDataStatus.ACTIVE,
        },
      }),
      this.db.attributeOptionSet.count({
        where: {
          code: { in: optionSetCodes },
          status: MasterDataStatus.ACTIVE,
        },
      }),
      this.db.attributeOptionValue.count({
        where: { OR: optionValueSelectors },
      }),
      this.db.attributeDefinition.count({
        where: {
          code: { in: attributeCodes },
          status: MasterDataStatus.ACTIVE,
        },
      }),
      this.db.attributeAlias.count({
        where: { OR: aliasSelectors },
      }),
      this.db.attributeAllowedValue.count({
        where: { OR: allowedValueSelectors },
      }),
    ]);

    return (
      attributeGroups === data.attributeGroups.length &&
      unitDimensions === data.unitDimensions.length &&
      attributeUnits === unitCodes.length &&
      optionSets === data.optionSets.length &&
      optionValues === optionValueSelectors.length &&
      attributes === data.attributes.length &&
      attributeAliases === aliasSelectors.length &&
      allowedValues === allowedValueSelectors.length
    );
  }

  async replace(_actorId: string): Promise<MasterReferenceInstallResult> {
    throw new ConflictException({
      code: 'LEGACY_VEHICLE_LIBRARY_RETIRED',
      message:
        'Full master replacement is disabled. Manage Vehicle and Catalog masters through Admin Pro. Attribute reconciliation remains available.',
    });
  }

  async install(actorId: string): Promise<MasterReferenceInstallResult> {
    return this.replace(actorId);
  }

  async replaceAttributes(actorId: string): Promise<AttributeMasterInstallResult> {
    if (this.replacementInProgress) {
      throw new ConflictException({
        code: 'MASTER_DATA_REPLACEMENT_IN_PROGRESS',
        message: 'A master-data replacement is already running.',
      });
    }

    this.replacementInProgress = true;
    try {
      await this.assertAttributeReplacementIsSafe();
      await this.clearAttributeMasterData();
      await this.createAttributes(actorId);

      const result: AttributeMasterInstallResult =
        this.attributeMasterExpectedCounts();

      await this.db.auditLog.create({
        data: {
          actorId,
          action: 'ATTRIBUTE_MASTER_DATA_REPLACED_BY_ADMIN',
          entityType: 'AttributeMasterDataReplacement',
          entityId: actorId,
          metadata: {
            source: 'LEMEKINAYE_MASTER_ATTRIBUTE_LIBRARY_V2',
            destructiveReplacement: true,
            vehicleMasterDataPreserved: true,
            ...result,
          },
        },
      });

      return result;
    } finally {
      this.replacementInProgress = false;
    }
  }

  async reconcileAttributes(
    actorId: string,
  ): Promise<AttributeMasterInstallResult> {
    if (this.replacementInProgress) {
      throw new ConflictException({
        code: 'MASTER_DATA_REPLACEMENT_IN_PROGRESS',
        message: 'A master-data replacement is already running.',
      });
    }

    this.replacementInProgress = true;
    try {
      const libraryErrors = validateMasterAttributeLibrary();
      if (libraryErrors.length > 0) {
        throw new Error(
          `Invalid canonical Master Attribute Library v2: ${libraryErrors.join('; ')}`,
        );
      }

      // Reconciliation is intentionally incremental rather than wrapped in one
      // large interactive transaction. The canonical library contains many
      // dependency-ordered upserts; committing each upsert makes the operation
      // restart-safe and prevents a late timeout from rolling the entire
      // Attribute library back to zero.
      await this.reconcileAttributeMasterData(this.db, actorId);
      const result = this.attributeMasterExpectedCounts();

      await this.db.auditLog.create({
        data: {
          actorId,
          action: 'ATTRIBUTE_MASTER_DATA_RECONCILED_BY_ADMIN',
          entityType: 'AttributeMasterDataReconciliation',
          entityId: actorId,
          metadata: {
            source: 'LEMEKINAYE_MASTER_ATTRIBUTE_LIBRARY_V2',
            destructiveReplacement: false,
            restartSafeIncremental: true,
            existingAttributeIdsPreserved: true,
            vehicleMasterDataPreserved: true,
            ...result,
          },
        },
      });

      return result;
    } finally {
      this.replacementInProgress = false;
    }
  }

  private async reconcileAttributeMasterData(
    tx: AttributeReconcileClient,
    actorId: string,
  ): Promise<void> {
    const groups = new Map<string, { id: string }>();
    for (const item of data.attributeGroups) {
      const record = await tx.attributeGroup.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
          status: MasterDataStatus.ACTIVE,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      groups.set(item.code, record);
    }

    const dimensions = new Map<string, { id: string }>();
    const units = new Map<string, { id: string; symbol: string }>();
    for (const dimensionSpec of data.unitDimensions) {
      const dimension = await tx.unitDimension.upsert({
        where: { code: dimensionSpec.code },
        create: {
          code: dimensionSpec.code,
          name: dimensionSpec.name,
          description: dimensionSpec.description,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          name: dimensionSpec.name,
          description: dimensionSpec.description,
          status: MasterDataStatus.ACTIVE,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      dimensions.set(dimensionSpec.code, dimension);

      for (const unitSpec of dimensionSpec.units) {
        const unit = await tx.attributeUnit.upsert({
          where: { code: unitSpec.code },
          create: {
            dimensionId: dimension.id,
            code: unitSpec.code,
            name: unitSpec.name,
            symbol: unitSpec.symbol,
            isBase: unitSpec.isBase,
            factorToBase: unitSpec.factorToBase,
            offsetToBase: unitSpec.offsetToBase,
            sortOrder: unitSpec.sortOrder,
            status: MasterDataStatus.ACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            dimensionId: dimension.id,
            name: unitSpec.name,
            symbol: unitSpec.symbol,
            isBase: unitSpec.isBase,
            factorToBase: unitSpec.factorToBase,
            offsetToBase: unitSpec.offsetToBase,
            sortOrder: unitSpec.sortOrder,
            status: MasterDataStatus.ACTIVE,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        units.set(unitSpec.code, { id: unit.id, symbol: unit.symbol });
      }
    }

    const optionSets = new Map<string, { id: string }>();
    for (const optionSetSpec of data.optionSets) {
      const optionSet = await tx.attributeOptionSet.upsert({
        where: { code: optionSetSpec.code },
        create: {
          code: optionSetSpec.code,
          name: optionSetSpec.name,
          description: optionSetSpec.description,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          name: optionSetSpec.name,
          description: optionSetSpec.description,
          status: MasterDataStatus.ACTIVE,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      optionSets.set(optionSetSpec.code, optionSet);

      for (const valueSpec of optionSetSpec.values) {
        await tx.attributeOptionValue.upsert({
          where: {
            optionSetId_code: {
              optionSetId: optionSet.id,
              code: valueSpec.code,
            },
          },
          create: {
            optionSetId: optionSet.id,
            code: valueSpec.code,
            label: valueSpec.label,
            sortOrder: valueSpec.sortOrder,
            status: MasterDataStatus.ACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            label: valueSpec.label,
            sortOrder: valueSpec.sortOrder,
            status: MasterDataStatus.ACTIVE,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
      }
    }

    const attributes = new Map<string, { id: string }>();
    for (const item of data.attributes) {
      const group = groups.get(item.groupCode);
      if (!group) {
        throw new Error(
          `Missing Attribute Group ${item.groupCode} for ${item.code}`,
        );
      }

      const optionSet = item.optionSetCode
        ? optionSets.get(item.optionSetCode)
        : undefined;
      const dimension = item.unitDimensionCode
        ? dimensions.get(item.unitDimensionCode)
        : undefined;
      const defaultUnit = item.defaultUnitCode
        ? units.get(item.defaultUnitCode)
        : undefined;

      if (item.optionSetCode && !optionSet) {
        throw new Error(
          `Missing Option Set ${item.optionSetCode} for ${item.code}`,
        );
      }
      if (item.unitDimensionCode && !dimension) {
        throw new Error(
          `Missing Unit Dimension ${item.unitDimensionCode} for ${item.code}`,
        );
      }
      if (item.defaultUnitCode && !defaultUnit) {
        throw new Error(
          `Missing default Unit ${item.defaultUnitCode} for ${item.code}`,
        );
      }

      const record = await tx.attributeDefinition.upsert({
        where: { code: item.code },
        create: {
          groupId: group.id,
          optionSetId: optionSet?.id,
          unitDimensionId: dimension?.id,
          defaultUnitId: defaultUnit?.id,
          code: item.code,
          name: item.name,
          dataType: item.dataType as AttributeDataType,
          scope: item.scope as AttributeScope,
          valueSource: item.valueSource as AttributeValueSource,
          unit: defaultUnit?.symbol ?? item.legacyUnit,
          description: item.description,
          exampleValue: item.exampleValue,
          validationRule:
            item.validationRule === null
              ? undefined
              : (item.validationRule as Prisma.InputJsonObject),
          repeatable: item.repeatable,
          translatable: item.translatable,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          groupId: group.id,
          optionSetId: optionSet?.id,
          unitDimensionId: dimension?.id,
          defaultUnitId: defaultUnit?.id,
          name: item.name,
          dataType: item.dataType as AttributeDataType,
          scope: item.scope as AttributeScope,
          valueSource: item.valueSource as AttributeValueSource,
          unit: defaultUnit?.symbol ?? item.legacyUnit,
          description: item.description,
          exampleValue: item.exampleValue,
          validationRule:
            item.validationRule === null
              ? Prisma.DbNull
              : (item.validationRule as Prisma.InputJsonObject),
          repeatable: item.repeatable,
          translatable: item.translatable,
          status: MasterDataStatus.ACTIVE,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      attributes.set(item.code, record);

      for (const aliasSpec of item.aliases) {
        const normalizedAlias = this.normalizeAttributeAlias(aliasSpec.alias);
        await tx.attributeAlias.upsert({
          where: {
            attributeId_normalizedAlias_locale: {
              attributeId: record.id,
              normalizedAlias,
              locale: aliasSpec.locale,
            },
          },
          create: {
            attributeId: record.id,
            alias: aliasSpec.alias,
            normalizedAlias,
            locale: aliasSpec.locale,
            status: MasterDataStatus.ACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            alias: aliasSpec.alias,
            status: MasterDataStatus.ACTIVE,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
      }
    }

    for (const item of data.allowedValues) {
      const attribute = attributes.get(item.attributeCode);
      if (!attribute) {
        throw new Error(
          `Missing canonical attribute ${item.attributeCode} for ${item.code}`,
        );
      }

      await tx.attributeAllowedValue.upsert({
        where: {
          attributeId_code: {
            attributeId: attribute.id,
            code: item.code,
          },
        },
        create: {
          attributeId: attribute.id,
          code: item.code,
          label: item.label,
          sortOrder: item.sortOrder,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          label: item.label,
          sortOrder: item.sortOrder,
          status: MasterDataStatus.ACTIVE,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
    }
  }

  private async assertAttributeReplacementIsSafe(): Promise<void> {
    const [assignments, schemas, templateItems, productValues, products] =
      await Promise.all([
        this.db.productTypeAttributeAssignment.count(),
        this.db.productTypeSchemaVersion.count(),
        this.db.productTypeCriteriaTemplateItem.count(),
        this.db.productAttributeValue.count(),
        this.db.product.count(),
      ]);

    if (
      assignments > 0 ||
      schemas > 0 ||
      templateItems > 0 ||
      productValues > 0 ||
      products > 0
    ) {
      throw new ConflictException({
        code: 'ATTRIBUTE_MASTER_REPLACEMENT_BLOCKED',
        message:
          'Attribute master replacement is blocked because catalog schemas or Products depend on the current attributes.',
        details: {
          productTypeAttributeAssignments: assignments,
          productTypeSchemaVersions: schemas,
          productTypeCriteriaTemplateItems: templateItems,
          productAttributeValues: productValues,
          products,
        },
      });
    }
  }

  private async clearAttributeMasterData(): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.attributeAlias.deleteMany();
      await tx.attributeAllowedValue.deleteMany();
      await tx.attributeDefinition.deleteMany();
      await tx.attributeOptionValue.deleteMany();
      await tx.attributeOptionSet.deleteMany();
      await tx.attributeUnit.deleteMany();
      await tx.unitDimension.deleteMany();
      await tx.attributeGroup.deleteMany();
    });
  }

  async cleanupLegacySeedCatalog(
    actorId: string,
  ): Promise<{
    removed: boolean;
    reason: 'removed' | 'already-empty' | 'not-legacy-seed-shape' | 'products-exist';
  }> {
    const [
      categories,
      rootCategories,
      productTypes,
      parentProductTypes,
      productFamilies,
      products,
      categoryCodes,
      productTypeCodes,
    ] = await Promise.all([
      this.db.category.count(),
      this.db.category.count({ where: { parentId: null } }),
      this.db.productType.count(),
      this.db.productType.count({ where: { parentId: null } }),
      this.db.productFamily.count(),
      this.db.product.count(),
      this.db.category.findMany({
        select: { code: true },
        orderBy: { code: 'asc' },
      }),
      this.db.productType.findMany({
        select: { code: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    if (categories === 0 && productTypes === 0 && productFamilies === 0) {
      return { removed: false, reason: 'already-empty' };
    }

    if (products > 0) {
      return { removed: false, reason: 'products-exist' };
    }

    const sameCodes = (
      actual: Array<{ code: string }>,
      expected: readonly string[],
    ) => {
      if (actual.length !== expected.length) return false;
      const actualCodes = actual.map((item) => item.code).sort();
      const expectedCodes = [...expected].sort();
      return actualCodes.every(
        (code, index) => code === expectedCodes[index],
      );
    };

    const matchesLegacySeedShape =
      categories === 30 &&
      rootCategories === 10 &&
      productTypes === 60 &&
      parentProductTypes === 20 &&
      productFamilies === 0 &&
      sameCodes(categoryCodes, LEGACY_SEEDED_CATEGORY_CODES) &&
      sameCodes(productTypeCodes, LEGACY_SEEDED_PRODUCT_TYPE_CODES);

    if (!matchesLegacySeedShape) {
      return { removed: false, reason: 'not-legacy-seed-shape' };
    }

    await this.db.$transaction(
      async (tx) => {
        await tx.productType.updateMany({
          data: { currentSchemaVersionId: null },
        });
        await tx.productTypeSchemaVersion.deleteMany();
        await tx.productTypeAttributeAssignment.deleteMany();
        await this.deleteProductTypesLeafFirst(tx);
        await tx.productFamily.deleteMany();
        await this.deleteCategoriesLeafFirst(tx);

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'LEGACY_SEEDED_PRODUCT_CATALOG_REMOVED',
            entityType: 'CatalogSeedCleanup',
            entityId: actorId,
            metadata: {
              categoriesRemoved: categories,
              productTypesRemoved: productTypes,
              targetHierarchy: 'CATEGORY_PART_GROUP_PRODUCT_TYPE',
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { removed: true, reason: 'removed' };
  }

  private async deleteProductTypesLeafFirst(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    while ((await tx.productType.count()) > 0) {
      const leaves = await tx.productType.findMany({
        where: { children: { none: {} } },
        select: { id: true },
      });
      if (leaves.length === 0) {
        throw new Error('Product Type hierarchy contains an undeletable cycle');
      }
      await tx.productType.deleteMany({
        where: { id: { in: leaves.map((item) => item.id) } },
      });
    }
  }

  private async deleteCategoriesLeafFirst(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    while ((await tx.category.count()) > 0) {
      const leaves = await tx.category.findMany({
        where: { children: { none: {} } },
        select: { id: true },
      });
      if (leaves.length === 0) {
        throw new Error('Category hierarchy contains an undeletable cycle');
      }
      await tx.category.deleteMany({
        where: { id: { in: leaves.map((item) => item.id) } },
      });
    }
  }

  private async createAttributes(actorId: string) {
    const libraryErrors = validateMasterAttributeLibrary();
    if (libraryErrors.length > 0) {
      throw new Error(
        `Invalid canonical Master Attribute Library v2: ${libraryErrors.join('; ')}`,
      );
    }

    const groups = new Map<string, { id: string }>();
    for (const item of data.attributeGroups) {
      const record = await this.db.attributeGroup.create({
        data: {
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      groups.set(item.code, record);
    }

    const dimensions = new Map<string, { id: string }>();
    const units = new Map<string, { id: string; symbol: string }>();
    for (const dimensionSpec of data.unitDimensions) {
      const dimension = await this.db.unitDimension.create({
        data: {
          code: dimensionSpec.code,
          name: dimensionSpec.name,
          description: dimensionSpec.description,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      dimensions.set(dimensionSpec.code, dimension);

      for (const unitSpec of dimensionSpec.units) {
        const unit = await this.db.attributeUnit.create({
          data: {
            dimensionId: dimension.id,
            code: unitSpec.code,
            name: unitSpec.name,
            symbol: unitSpec.symbol,
            isBase: unitSpec.isBase,
            factorToBase: unitSpec.factorToBase,
            offsetToBase: unitSpec.offsetToBase,
            sortOrder: unitSpec.sortOrder,
            status: MasterDataStatus.ACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        units.set(unitSpec.code, { id: unit.id, symbol: unit.symbol });
      }
    }

    const optionSets = new Map<string, { id: string }>();
    for (const optionSetSpec of data.optionSets) {
      const optionSet = await this.db.attributeOptionSet.create({
        data: {
          code: optionSetSpec.code,
          name: optionSetSpec.name,
          description: optionSetSpec.description,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      optionSets.set(optionSetSpec.code, optionSet);

      for (const valueSpec of optionSetSpec.values) {
        await this.db.attributeOptionValue.create({
          data: {
            optionSetId: optionSet.id,
            code: valueSpec.code,
            label: valueSpec.label,
            sortOrder: valueSpec.sortOrder,
            status: MasterDataStatus.ACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
        });
      }
    }

    const attributes = new Map<
      string,
      Awaited<ReturnType<typeof this.db.attributeDefinition.create>>
    >();

    for (const item of data.attributes) {
      const group = groups.get(item.groupCode);
      if (!group) {
        throw new Error(
          `Missing Attribute Group ${item.groupCode} for ${item.code}`,
        );
      }

      const optionSet = item.optionSetCode
        ? optionSets.get(item.optionSetCode)
        : undefined;
      const dimension = item.unitDimensionCode
        ? dimensions.get(item.unitDimensionCode)
        : undefined;
      const defaultUnit = item.defaultUnitCode
        ? units.get(item.defaultUnitCode)
        : undefined;

      if (item.optionSetCode && !optionSet) {
        throw new Error(
          `Missing Option Set ${item.optionSetCode} for ${item.code}`,
        );
      }
      if (item.unitDimensionCode && !dimension) {
        throw new Error(
          `Missing Unit Dimension ${item.unitDimensionCode} for ${item.code}`,
        );
      }
      if (item.defaultUnitCode && !defaultUnit) {
        throw new Error(
          `Missing default Unit ${item.defaultUnitCode} for ${item.code}`,
        );
      }

      const record = await this.db.attributeDefinition.create({
        data: {
          groupId: group.id,
          optionSetId: optionSet?.id,
          unitDimensionId: dimension?.id,
          defaultUnitId: defaultUnit?.id,
          code: item.code,
          name: item.name,
          dataType: item.dataType as AttributeDataType,
          scope: item.scope as AttributeScope,
          valueSource: item.valueSource as AttributeValueSource,
          unit: defaultUnit?.symbol ?? item.legacyUnit,
          description: item.description,
          exampleValue: item.exampleValue,
          validationRule:
            item.validationRule === null
              ? undefined
              : (item.validationRule as Prisma.InputJsonObject),
          repeatable: item.repeatable,
          translatable: item.translatable,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      attributes.set(item.code, record);

      for (const aliasSpec of item.aliases) {
        await this.db.attributeAlias.create({
          data: {
            attributeId: record.id,
            alias: aliasSpec.alias,
            normalizedAlias: this.normalizeAttributeAlias(aliasSpec.alias),
            locale: aliasSpec.locale,
            status: MasterDataStatus.ACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
        });
      }
    }

    // Compatibility bridge: current published Product Type schemas still read
    // AttributeAllowedValue. These rows mirror reusable Option Sets until the
    // schema publisher switches fully to optionSetId.
    for (const item of data.allowedValues) {
      const attribute = attributes.get(item.attributeCode);
      if (!attribute) {
        throw new Error(
          `Missing canonical attribute ${item.attributeCode} for ${item.code}`,
        );
      }
      await this.db.attributeAllowedValue.create({
        data: {
          attributeId: attribute.id,
          code: item.code,
          label: item.label,
          sortOrder: item.sortOrder,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
    }

    return attributes;
  }

  private attributeMasterExpectedCounts(): AttributeMasterInstallResult {
    return {
      attributeGroups: data.attributeGroups.length,
      unitDimensions: data.unitDimensions.length,
      attributeUnits: data.unitDimensions.reduce(
        (total, dimension) => total + dimension.units.length,
        0,
      ),
      optionSets: data.optionSets.length,
      optionValues: data.optionSets.reduce(
        (total, optionSet) => total + optionSet.values.length,
        0,
      ),
      attributes: data.attributes.length,
      attributeAliases: data.attributes.reduce(
        (total, attribute) => total + attribute.aliases.length,
        0,
      ),
      allowedValues: data.allowedValues.length,
    };
  }

  private normalizeAttributeAlias(value: string): string {
    return value
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/\s+/gu, ' ');
  }

}
