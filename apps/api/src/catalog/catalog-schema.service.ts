import { createHash } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  Prisma,
  type ProductTypeSchemaVersion,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  ProductTypeSchemaVersionResponseDto,
  PublishProductTypeSchemaDto,
} from './dto/product-type-schema.dto.js';

const schemaVersionSelect = {
  id: true,
  productTypeId: true,
  schemaVersion: true,
  schemaHash: true,
  snapshot: true,
  publishedAt: true,
} satisfies Prisma.ProductTypeSchemaVersionSelect;

const schemaAssignmentSelect = {
  id: true,
  requirement: true,
  displayMode: true,
  displayOrder: true,
  validationRule: true,
  conditionalRule: true,
  defaultUnitId: true,
  searchable: true,
  filterable: true,
  comparable: true,
  variantDefining: true,
  marketplaceVisible: true,
  sellerEditable: true,
  status: true,
  defaultUnit: {
    select: {
      id: true,
      code: true,
      name: true,
      symbol: true,
      status: true,
    },
  },
  attribute: {
    select: {
      id: true,
      groupId: true,
      optionSetId: true,
      unitDimensionId: true,
      defaultUnitId: true,
      code: true,
      name: true,
      dataType: true,
      scope: true,
      valueSource: true,
      unit: true,
      description: true,
      exampleValue: true,
      validationRule: true,
      repeatable: true,
      translatable: true,
      status: true,
      group: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      optionSet: {
        select: {
          id: true,
          code: true,
          name: true,
          values: {
            where: { status: MasterDataStatus.ACTIVE },
            orderBy: [{ sortOrder: 'asc' as const }, { code: 'asc' as const }],
            select: {
              id: true,
              code: true,
              label: true,
              description: true,
              sortOrder: true,
            },
          },
        },
      },
      unitDimension: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      defaultUnit: {
        select: {
          id: true,
          code: true,
          name: true,
          symbol: true,
        },
      },
      aliases: {
        where: { status: MasterDataStatus.ACTIVE },
        orderBy: [{ locale: 'asc' as const }, { alias: 'asc' as const }],
        select: {
          alias: true,
          locale: true,
        },
      },
      allowedValues: {
        where: { status: MasterDataStatus.ACTIVE },
        orderBy: [{ sortOrder: 'asc' as const }, { code: 'asc' as const }],
        select: {
          id: true,
          code: true,
          label: true,
          description: true,
          sortOrder: true,
        },
      },
    },
  },
} satisfies Prisma.ProductTypeAttributeAssignmentSelect;

type SchemaAssignment = Prisma.ProductTypeAttributeAssignmentGetPayload<{
  select: typeof schemaAssignmentSelect;
}>;

@Injectable()
export class CatalogSchemaService {
  constructor(private readonly database: DatabaseService) {}

  async listAdminVersions(
    productTypeId: string,
  ): Promise<ProductTypeSchemaVersionResponseDto[]> {
    const productType = await this.database.productType.findUnique({
      where: { id: productTypeId },
      select: { id: true },
    });
    if (!productType) throw this.productTypeNotFound();

    return this.database.productTypeSchemaVersion.findMany({
      where: { productTypeId },
      select: schemaVersionSelect,
      orderBy: { schemaVersion: 'desc' },
    });
  }

  async publish(
    productTypeId: string,
    input: PublishProductTypeSchemaDto,
    actorId: string,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const productType = await transaction.productType.findUnique({
            where: { id: productTypeId },
            select: {
              id: true,
              categoryId: true,
              productFamilyId: true,
              code: true,
              name: true,
              slug: true,
              brandRequirement: true,
              identifierRequirement: true,
              gtinRequirement: true,
              oemReferenceRequirement: true,
              crossReferenceRequirement: true,
              fitmentRequirement: true,
              imageRequirement: true,
              minimumImageCount: true,
              maximumImageCount: true,
              documentRequirement: true,
              minimumDocumentCount: true,
              priceRequirement: true,
              stockRequirement: true,
              conditionRequirement: true,
              warrantyRequirement: true,
              status: true,
              version: true,
              currentSchemaVersionId: true,
            },
          });

          if (!productType) throw this.productTypeNotFound();
          if (productType.version !== input.productTypeVersion) {
            throw this.productTypeVersionConflict();
          }
          if (!productType.productFamilyId) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_PART_GROUP_REQUIRED',
              message:
                'Assign the Product Type to a Part Group before publishing its schema',
            });
          }

          const category = await transaction.category.findUnique({
            where: { id: productType.categoryId },
            select: { id: true, status: true, version: true },
          });
          const partGroup = await transaction.productFamily.findUnique({
            where: { id: productType.productFamilyId },
            select: { id: true, categoryId: true, status: true, version: true },
          });
          if (!category || !partGroup || partGroup.categoryId !== productType.categoryId) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_CLASSIFICATION_INVALID',
              message: 'The Product Type classification is incomplete or inconsistent',
            });
          }
          if (
            category.status === MasterDataStatus.INACTIVE ||
            category.status === MasterDataStatus.ARCHIVED ||
            partGroup.status === MasterDataStatus.INACTIVE ||
            partGroup.status === MasterDataStatus.ARCHIVED ||
            productType.status === MasterDataStatus.INACTIVE ||
            productType.status === MasterDataStatus.ARCHIVED
          ) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_CLASSIFICATION_NOT_PUBLISHABLE',
              message: 'Inactive or archived catalog records cannot be published',
            });
          }

          const assignments =
            await transaction.productTypeAttributeAssignment.findMany({
              where: {
                productTypeId,
                status: {
                  in: [MasterDataStatus.ACTIVE, MasterDataStatus.DRAFT],
                },
              },
              orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
              select: schemaAssignmentSelect,
            });

          if (assignments.length === 0) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_EMPTY',
              message: 'Assign at least one Technical Attribute before publishing',
            });
          }

          const inactiveAttribute = assignments.find(
            (assignment) =>
              assignment.attribute.status !== MasterDataStatus.ACTIVE,
          );
          if (inactiveAttribute) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_ATTRIBUTE_NOT_ACTIVE',
              message:
                'All attributes in a published Product Type schema must be active',
            });
          }

          const invalidScopeAttribute = assignments.find(
            (assignment) =>
              assignment.attribute.scope !== AttributeScope.PRODUCT,
          );
          if (invalidScopeAttribute) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_ATTRIBUTE_SCOPE_INVALID',
              message:
                'A published Product Type schema can contain only PRODUCT-scope Technical Attributes',
            });
          }

          const inactiveDefaultUnit = assignments.find(
            (assignment) =>
              assignment.defaultUnit &&
              assignment.defaultUnit.status !== MasterDataStatus.ACTIVE,
          );
          if (inactiveDefaultUnit) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_UNIT_NOT_ACTIVE',
              message:
                'All default Units in a published Product Type schema must be active',
            });
          }
          const ungroupedAttribute = assignments.find(
            (assignment) => !assignment.attribute.group,
          );
          if (ungroupedAttribute) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_ATTRIBUTE_GROUP_REQUIRED',
              message:
                'Every published Technical Attribute must belong to an Attribute Group',
            });
          }

          const missingUnit = assignments.find(
            (assignment) =>
              assignment.attribute.unitDimensionId && !assignment.defaultUnit,
          );
          if (missingUnit) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_DEFAULT_UNIT_REQUIRED',
              message:
                'Every published unit-based Technical Attribute requires a default Unit',
            });
          }

          const missingControlledValues = assignments.find((assignment) => {
            const attribute = assignment.attribute;
            if (attribute.valueSource !== AttributeValueSource.STATIC) {
              return false;
            }
            if (
              attribute.dataType !== 'SELECT' &&
              attribute.dataType !== 'MULTI_SELECT'
            ) {
              return false;
            }
            const values =
              attribute.optionSet?.values ?? attribute.allowedValues;
            return values.length === 0;
          });
          if (missingControlledValues) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_ALLOWED_VALUES_REQUIRED',
              message:
                'STATIC select Attributes require at least one active allowed value before publishing',
            });
          }

          for (const assignment of assignments) {
            this.assertEffectiveValidationRule(
              assignment.attribute.dataType,
              assignment.attribute.validationRule,
              assignment.validationRule,
            );
          }


          if (category.status === MasterDataStatus.DRAFT) {
            await transaction.category.update({
              where: { id: category.id, version: category.version },
              data: {
                status: MasterDataStatus.ACTIVE,
                version: { increment: 1 },
                updatedById: actorId,
              },
            });
          }
          if (partGroup.status === MasterDataStatus.DRAFT) {
            await transaction.productFamily.update({
              where: { id: partGroup.id, version: partGroup.version },
              data: {
                status: MasterDataStatus.ACTIVE,
                version: { increment: 1 },
                updatedById: actorId,
              },
            });
          }
          await transaction.productTypeAttributeAssignment.updateMany({
            where: {
              productTypeId,
              status: MasterDataStatus.DRAFT,
            },
            data: {
              status: MasterDataStatus.ACTIVE,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });

          const snapshot = this.buildSnapshot(productType, assignments);
          const schemaHash = this.hashSnapshot(snapshot);

          const latest = await transaction.productTypeSchemaVersion.findFirst({
            where: { productTypeId },
            orderBy: { schemaVersion: 'desc' },
            select: {
              id: true,
              schemaVersion: true,
              schemaHash: true,
            },
          });

          if (latest?.schemaHash === schemaHash) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_SCHEMA_UNCHANGED',
              message:
                'The current Product Type configuration already has a published schema',
            });
          }

          const schema = await transaction.productTypeSchemaVersion.create({
            data: {
              productTypeId,
              schemaVersion: (latest?.schemaVersion ?? 0) + 1,
              schemaHash,
              snapshot,
              publishedById: actorId,
            },
          });

          await transaction.productType.update({
            where: {
              id: productTypeId,
              version: input.productTypeVersion,
            },
            data: {
              status: MasterDataStatus.ACTIVE,
              currentSchemaVersionId: schema.id,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_SCHEMA_PUBLISHED',
              entityType: 'ProductTypeSchemaVersion',
              entityId: schema.id,
              metadata: {
                productTypeId,
                schemaVersion: schema.schemaVersion,
                schemaHash,
                previousSchemaVersionId: productType.currentSchemaVersionId,
                attributeCount: assignments.length,
                activatedCategory: category.status === MasterDataStatus.DRAFT,
                activatedPartGroup:
                  partGroup.status === MasterDataStatus.DRAFT,
                activatedProductType:
                  productType.status === MasterDataStatus.DRAFT,
                activatedAssignmentIds: assignments
                  .filter(
                    (assignment) =>
                      assignment.status === MasterDataStatus.DRAFT,
                  )
                  .map((assignment) => assignment.id),
              },
            },
          });

          return this.toResponse(schema);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async getCurrentPublishedSchema(
    productTypeId: string,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    const productType = await this.database.productType.findFirst({
      where: {
        id: productTypeId,
        status: MasterDataStatus.ACTIVE,
        currentSchemaVersionId: { not: null },
      },
      select: { currentSchemaVersionId: true },
    });
    if (!productType?.currentSchemaVersionId) {
      throw this.publishedSchemaNotFound();
    }

    const schema = await this.database.productTypeSchemaVersion.findUnique({
      where: { id: productType.currentSchemaVersionId },
      select: schemaVersionSelect,
    });
    if (!schema || schema.productTypeId !== productTypeId) {
      throw this.publishedSchemaNotFound();
    }

    return schema;
  }

  async getPublishedSchemaVersion(
    productTypeId: string,
    schemaVersion: number,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    const schema = await this.database.productTypeSchemaVersion.findUnique({
      where: {
        productTypeId_schemaVersion: {
          productTypeId,
          schemaVersion,
        },
      },
      select: schemaVersionSelect,
    });

    if (!schema) throw this.publishedSchemaNotFound();
    return schema;
  }

  private buildSnapshot(
    productType: {
      id: string;
      categoryId: string;
      productFamilyId: string | null;
      code: string;
      name: string;
      slug: string;
      brandRequirement: string;
      identifierRequirement: string;
      gtinRequirement: string;
      oemReferenceRequirement: string;
      crossReferenceRequirement: string;
      fitmentRequirement: string;
      imageRequirement: string;
      minimumImageCount: number;
      maximumImageCount: number;
      documentRequirement: string;
      minimumDocumentCount: number;
      priceRequirement: string;
      stockRequirement: string;
      conditionRequirement: string;
      warrantyRequirement: string;
    },
    assignments: SchemaAssignment[],
  ): Prisma.InputJsonObject {
    const attributes: Prisma.InputJsonArray = assignments.map((assignment) => {
      const attribute = assignment.attribute;
      const controlledValues: Prisma.InputJsonArray =
        attribute.valueSource === AttributeValueSource.STATIC
          ? (attribute.optionSet?.values ?? attribute.allowedValues).map(
              (value) => ({
                id: value.id,
                code: value.code,
                label: value.label,
                description: value.description,
                sortOrder: value.sortOrder,
              }),
            )
          : [];

      return {
        assignmentId: assignment.id,
        attributeId: attribute.id,
        code: attribute.code,
        name: attribute.name,
        dataType: attribute.dataType,
        scope: attribute.scope,
        valueSource: attribute.valueSource,
        group: attribute.group
          ? {
              id: attribute.group.id,
              code: attribute.group.code,
              name: attribute.group.name,
            }
          : null,
        optionSet: attribute.optionSet
          ? {
              id: attribute.optionSet.id,
              code: attribute.optionSet.code,
              name: attribute.optionSet.name,
            }
          : null,
        unitDimension: attribute.unitDimension
          ? {
              id: attribute.unitDimension.id,
              code: attribute.unitDimension.code,
              name: attribute.unitDimension.name,
            }
          : null,
        attributeDefaultUnit: attribute.defaultUnit
          ? {
              id: attribute.defaultUnit.id,
              code: attribute.defaultUnit.code,
              name: attribute.defaultUnit.name,
              symbol: attribute.defaultUnit.symbol,
            }
          : null,
        assignmentDefaultUnit: assignment.defaultUnit
          ? {
              id: assignment.defaultUnit.id,
              code: assignment.defaultUnit.code,
              name: assignment.defaultUnit.name,
              symbol: assignment.defaultUnit.symbol,
            }
          : null,
        unit: assignment.defaultUnit?.symbol ?? attribute.unit,
        description: attribute.description,
        exampleValue: attribute.exampleValue,
        attributeValidationRule:
          attribute.validationRule === null
            ? null
            : (attribute.validationRule as Prisma.InputJsonValue),
        repeatable: attribute.repeatable,
        translatable: attribute.translatable,
        aliases: attribute.aliases.map((alias) => ({
          alias: alias.alias,
          locale: alias.locale,
        })),
        requirement: assignment.requirement,
        displayMode: assignment.displayMode,
        displayOrder: assignment.displayOrder,
        validationRule: this.mergeValidationRules(
          attribute.validationRule,
          assignment.validationRule,
        ),
        conditionalRule:
          assignment.conditionalRule === null
            ? null
            : (assignment.conditionalRule as Prisma.InputJsonValue),
        searchable: assignment.searchable,
        filterable: assignment.filterable,
        comparable: assignment.comparable,
        variantDefining: assignment.variantDefining,
        marketplaceVisible: assignment.marketplaceVisible,
        sellerEditable: assignment.sellerEditable,
        controlledValues,
      };
    });

    return {
      schemaKind: 'PRODUCT_TYPE_SCHEMA',
      contractVersion: 2,
      productType: {
        id: productType.id,
        categoryId: productType.categoryId,
        productFamilyId: productType.productFamilyId,
        code: productType.code,
        name: productType.name,
        slug: productType.slug,
      },
      articleRequirements: {
        brand: productType.brandRequirement,
        identifier: productType.identifierRequirement,
        gtin: productType.gtinRequirement,
        oeReference: productType.oemReferenceRequirement,
        crossReference: productType.crossReferenceRequirement,
        fitment: productType.fitmentRequirement,
        image: productType.imageRequirement,
        minimumImageCount: productType.minimumImageCount,
        maximumImageCount: productType.maximumImageCount,
        document: productType.documentRequirement,
        minimumDocumentCount: productType.minimumDocumentCount,
      },
      offerRequirements: {
        price: productType.priceRequirement,
        stock: productType.stockRequirement,
        condition: productType.conditionRequirement,
        warranty: productType.warrantyRequirement,
      },
      attributes,
      searchableAttributeCodes: assignments
        .filter((assignment) => assignment.searchable)
        .map((assignment) => assignment.attribute.code),
      filterableAttributeCodes: assignments
        .filter((assignment) => assignment.filterable)
        .map((assignment) => assignment.attribute.code),
      comparableAttributeCodes: assignments
        .filter((assignment) => assignment.comparable)
        .map((assignment) => assignment.attribute.code),
    };
  }

  private assertEffectiveValidationRule(
    dataType: string,
    attributeRule: Prisma.JsonValue | null,
    assignmentRule: Prisma.JsonValue | null,
  ): void {
    const merged = this.mergeValidationRules(attributeRule, assignmentRule);
    if (!this.isJsonObject(merged)) return;

    const supportedKeys = new Set(['min', 'max', 'minLength', 'maxLength']);
    const unsupportedKeys = Object.keys(merged).filter(
      (key) => !supportedKeys.has(key),
    );
    if (unsupportedKeys.length > 0) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_SCHEMA_VALIDATION_RULE_UNSUPPORTED',
        message:
          'Published validation rules support only min, max, minLength and maxLength',
        details: { unsupportedKeys },
      });
    }

    const numericTypes = new Set([
      'INTEGER',
      'DECIMAL',
      'MONEY',
      'MEASUREMENT',
    ]);
    const lengthTypes = new Set([
      'TEXT',
      'LONG_TEXT',
      'COUNTRY',
      'IMAGE',
      'VIDEO',
      'FILE',
      'SELECT',
      'DATE',
      'DATETIME',
      'UUID',
      'REFERENCE',
      'MULTI_SELECT',
      'MULTI_REFERENCE',
      'MULTI_IMAGE',
    ]);

    const min = merged.min;
    const max = merged.max;
    const minLength = merged.minLength;
    const maxLength = merged.maxLength;

    if (min !== undefined || max !== undefined) {
      if (!numericTypes.has(dataType)) {
        throw new ConflictException({
          code: 'PRODUCT_TYPE_SCHEMA_NUMERIC_RULE_NOT_ALLOWED',
          message:
            'Published minimum/maximum rules require a numeric or measurement Attribute',
        });
      }
      if (
        (min !== undefined &&
          (typeof min !== 'number' || !Number.isFinite(min))) ||
        (max !== undefined &&
          (typeof max !== 'number' || !Number.isFinite(max)))
      ) {
        throw new ConflictException({
          code: 'PRODUCT_TYPE_SCHEMA_NUMERIC_RULE_INVALID',
          message: 'Published minimum and maximum must be finite numbers',
        });
      }
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        throw new ConflictException({
          code: 'PRODUCT_TYPE_SCHEMA_NUMERIC_RANGE_INVALID',
          message:
            'Published effective minimum cannot be greater than maximum',
        });
      }
    }

    if (minLength !== undefined || maxLength !== undefined) {
      if (!lengthTypes.has(dataType)) {
        throw new ConflictException({
          code: 'PRODUCT_TYPE_SCHEMA_LENGTH_RULE_NOT_ALLOWED',
          message:
            'Published length rules require text or multi-value Attributes',
        });
      }
      for (const value of [minLength, maxLength]) {
        if (
          value !== undefined &&
          (!Number.isInteger(value) || (value as number) < 0)
        ) {
          throw new ConflictException({
            code: 'PRODUCT_TYPE_SCHEMA_LENGTH_RULE_INVALID',
            message:
              'Published length limits must be non-negative integers',
          });
        }
      }
      if (
        typeof minLength === 'number' &&
        typeof maxLength === 'number' &&
        minLength > maxLength
      ) {
        throw new ConflictException({
          code: 'PRODUCT_TYPE_SCHEMA_LENGTH_RANGE_INVALID',
          message:
            'Published effective minimum length cannot be greater than maximum length',
        });
      }
    }
  }

  private mergeValidationRules(
    attributeRule: Prisma.JsonValue | null,
    assignmentRule: Prisma.JsonValue | null,
  ): Prisma.InputJsonObject | null {
    const inherited = this.isJsonObject(attributeRule) ? attributeRule : {};
    const override = this.isJsonObject(assignmentRule) ? assignmentRule : {};
    const merged = { ...inherited, ...override };
    return Object.keys(merged).length === 0
      ? null
      : (merged as Prisma.InputJsonObject);
  }

  private isJsonObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  private hashSnapshot(snapshot: Prisma.InputJsonObject): string {
    return createHash('sha256')
      .update(this.stableStringify(snapshot))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value) ?? 'null';
  }

  private toResponse(
    schema: ProductTypeSchemaVersion,
  ): ProductTypeSchemaVersionResponseDto {
    return {
      id: schema.id,
      productTypeId: schema.productTypeId,
      schemaVersion: schema.schemaVersion,
      schemaHash: schema.schemaHash,
      snapshot: schema.snapshot,
      publishedAt: schema.publishedAt,
    };
  }

  private productTypeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_TYPE_NOT_FOUND',
      message: 'Product type was not found',
    });
  }

  private publishedSchemaNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_TYPE_SCHEMA_NOT_FOUND',
      message: 'Published Product Type schema was not found',
    });
  }

  private productTypeVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'PRODUCT_TYPE_SCHEMA_VERSION_CONFLICT',
      message:
        'The Product Type changed; reload it before publishing the schema',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' ||
        error.code === 'P2025' ||
        error.code === 'P2034')
    ) {
      throw this.productTypeVersionConflict();
    }
    throw error;
  }
}
