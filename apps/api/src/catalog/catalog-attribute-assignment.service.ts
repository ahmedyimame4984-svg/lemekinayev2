import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttributeDataType,
  AttributeScope,
  MasterDataStatus,
  Prisma,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  type AttributeDefinition,
  type ProductTypeAttributeAssignment,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  AttributeDefinitionPageResponseDto,
  AttributeDefinitionResponseDto,
  AttributeDefinitionSummaryResponseDto,
} from './dto/attribute.dto.js';
import type {
  AvailableProductTypeAttributePageQueryDto,
  BulkCreateProductTypeAttributeAssignmentsDto,
  BulkDeleteProductTypeAttributeAssignmentsDto,
  BulkUpdateProductTypeAttributeAssignmentsDto,
  CreateProductTypeAttributeAssignmentDto,
  ProductTypeAttributeAssignmentAdminQueryDto,
  ProductTypeAttributeAssignmentResponseDto,
  UpdateProductTypeAttributeAssignmentDto,
} from './dto/product-type-attribute.dto.js';

const availableAttributeSelect = {
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
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeDefinitionSelect;

const assignmentSelect = {
  id: true,
  productTypeId: true,
  attributeId: true,
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
  version: true,
  createdAt: true,
  updatedAt: true,
  attribute: { select: availableAttributeSelect },
} satisfies Prisma.ProductTypeAttributeAssignmentSelect;

@Injectable()
export class CatalogAttributeAssignmentService {
  constructor(private readonly database: DatabaseService) {}

  async listAdminAssignments(
    productTypeId: string,
    query: ProductTypeAttributeAssignmentAdminQueryDto,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    await this.requireProductType(productTypeId);

    return this.database.productTypeAttributeAssignment.findMany({
      where: {
        productTypeId,
        status: query.status,
        requirement: query.requirement,
      },
      select: assignmentSelect,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listAvailableAttributes(
    productTypeId: string,
  ): Promise<AttributeDefinitionResponseDto[]> {
    await this.requireProductType(productTypeId);

    return this.database.attributeDefinition.findMany({
      where: {
        status: MasterDataStatus.ACTIVE,
        scope: AttributeScope.PRODUCT,
        productTypeAssignments: {
          none: { productTypeId },
        },
      },
      select: availableAttributeSelect,
      orderBy: [{ code: 'asc' }],
    });
  }

  async listAvailableAttributesPage(
    productTypeId: string,
    query: AvailableProductTypeAttributePageQueryDto,
  ): Promise<AttributeDefinitionPageResponseDto> {
    await this.requireProductType(productTypeId);

    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.AttributeDefinitionWhereInput = {
      status: MasterDataStatus.ACTIVE,
      scope: AttributeScope.PRODUCT,
      groupId: query.ungrouped ? null : query.groupId,
      productTypeAssignments: {
        none: { productTypeId },
      },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { unit: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.database.attributeDefinition.count({ where }),
      this.database.attributeDefinition.findMany({
        where,
        select: availableAttributeSelect,
        orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getAvailableAttributeSummary(
    productTypeId: string,
  ): Promise<AttributeDefinitionSummaryResponseDto> {
    await this.requireProductType(productTypeId);

    const grouped = await this.database.attributeDefinition.groupBy({
      by: ['groupId'],
      where: {
        status: MasterDataStatus.ACTIVE,
        scope: AttributeScope.PRODUCT,
        productTypeAssignments: {
          none: { productTypeId },
        },
      },
      _count: { _all: true },
    });

    const groupCounts: Record<string, number> = {};
    let ungrouped = 0;
    let total = 0;

    for (const group of grouped) {
      const count = group._count._all;
      total += count;
      if (group.groupId === null) {
        ungrouped = count;
      } else {
        groupCounts[group.groupId] = count;
      }
    }

    return { total, ungrouped, groupCounts };
  }

  async createAssignment(
    productTypeId: string,
    input: CreateProductTypeAttributeAssignmentDto,
    actorId: string,
  ): Promise<ProductTypeAttributeAssignmentResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const [productType, attribute] = await Promise.all([
            transaction.productType.findUnique({
              where: { id: productTypeId },
            }),
            transaction.attributeDefinition.findUnique({
              where: { id: input.attributeId },
            }),
          ]);

          if (!productType) throw this.productTypeNotFound();
          if (!attribute) throw this.attributeNotFound();
          this.assertProductAttributeScope(attribute.scope);

          const requirement =
            input.requirement ?? ProductTypeAttributeRequirement.OPTIONAL;
          this.assertConditionalRule(requirement, input.conditionalRule);
          this.assertValidationRule(attribute, input.validationRule);

          const status = input.status ?? MasterDataStatus.DRAFT;
          this.assertActiveParents(status, productType.status, attribute.status);

          const defaultUnitId =
            input.defaultUnitId === undefined
              ? attribute.defaultUnitId
              : input.defaultUnitId;
          await this.assertDefaultUnit(
            transaction,
            attribute,
            defaultUnitId,
            status,
          );

          const assignment =
            await transaction.productTypeAttributeAssignment.create({
              data: {
                productTypeId,
                attributeId: input.attributeId,
                requirement,
                displayMode:
                  input.displayMode ?? ProductTypeAttributeDisplayMode.VISIBLE,
                displayOrder: input.displayOrder ?? 0,
                validationRule: this.jsonInput(input.validationRule),
                conditionalRule: this.jsonInput(input.conditionalRule),
                defaultUnitId,
                searchable: input.searchable ?? false,
                filterable: input.filterable ?? false,
                comparable: input.comparable ?? false,
                variantDefining: input.variantDefining ?? false,
                marketplaceVisible: input.marketplaceVisible ?? true,
                sellerEditable: input.sellerEditable ?? true,
                status,
                createdById: actorId,
                updatedById: actorId,
              },
            });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_ATTRIBUTE_ASSIGNED',
              entityType: 'ProductTypeAttributeAssignment',
              entityId: assignment.id,
              metadata: { after: this.assignmentSnapshot(assignment) },
            },
          });

          return this.toAssignmentResponse(assignment);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async createAssignmentsBulk(
    productTypeId: string,
    input: BulkCreateProductTypeAttributeAssignmentsDto,
    actorId: string,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    const attributeIds = [...new Set(input.attributeIds)];
    if (attributeIds.length !== input.attributeIds.length) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_DUPLICATE_IDS',
        message: 'Select each Attribute only once',
      });
    }

    const requirement =
      input.requirement ?? ProductTypeAttributeRequirement.OPTIONAL;
    if (requirement === ProductTypeAttributeRequirement.CONDITIONAL) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_CONDITIONAL_UNSUPPORTED',
        message:
          'Conditional attributes require individual condition rules and cannot be bulk assigned',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const [productType, attributes, existing] = await Promise.all([
            transaction.productType.findUnique({
              where: { id: productTypeId },
            }),
            transaction.attributeDefinition.findMany({
              where: { id: { in: attributeIds } },
            }),
            transaction.productTypeAttributeAssignment.findMany({
              where: {
                productTypeId,
                attributeId: { in: attributeIds },
              },
              select: { attributeId: true },
            }),
          ]);

          if (!productType) throw this.productTypeNotFound();
          if (attributes.length !== attributeIds.length) {
            const found = new Set(attributes.map((attribute) => attribute.id));
            throw new NotFoundException({
              code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_ATTRIBUTE_NOT_FOUND',
              message: 'One or more selected Attributes were not found',
              details: {
                missingAttributeIds: attributeIds.filter((id) => !found.has(id)),
              },
            });
          }
          if (existing.length > 0) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_ATTRIBUTE_ALREADY_ASSIGNED',
              message:
                'One or more selected Attributes are already assigned to this Product Type',
              details: {
                attributeIds: existing.map((item) => item.attributeId),
              },
            });
          }

          const byId = new Map(
            attributes.map((attribute) => [attribute.id, attribute]),
          );
          const status = input.status ?? MasterDataStatus.DRAFT;
          const startDisplayOrder = input.startDisplayOrder ?? 0;
          const created: ProductTypeAttributeAssignment[] = [];

          for (const [index, attributeId] of attributeIds.entries()) {
            const attribute = byId.get(attributeId);
            if (!attribute) {
              throw this.attributeNotFound();
            }
            this.assertProductAttributeScope(attribute.scope);

            this.assertActiveParents(
              status,
              productType.status,
              attribute.status,
            );
            await this.assertDefaultUnit(
              transaction,
              attribute,
              attribute.defaultUnitId,
              status,
            );

            const assignment =
              await transaction.productTypeAttributeAssignment.create({
                data: {
                  productTypeId,
                  attributeId,
                  requirement,
                  displayMode:
                    input.displayMode ??
                    ProductTypeAttributeDisplayMode.VISIBLE,
                  displayOrder: startDisplayOrder + index,
                  defaultUnitId: attribute.defaultUnitId,
                  searchable: input.searchable ?? false,
                  filterable: input.filterable ?? false,
                  comparable: input.comparable ?? false,
                  variantDefining: input.variantDefining ?? false,
                  marketplaceVisible: input.marketplaceVisible ?? true,
                  sellerEditable: input.sellerEditable ?? true,
                  status,
                  createdById: actorId,
                  updatedById: actorId,
                },
              });
            created.push(assignment);
          }

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_ATTRIBUTES_BULK_ASSIGNED',
              entityType: 'ProductType',
              entityId: productTypeId,
              metadata: {
                productTypeId,
                attributeIds,
                assignmentIds: created.map((item) => item.id),
                requirement,
                status,
                count: created.length,
              },
            },
          });

          return created.map((assignment) =>
            this.toAssignmentResponse(assignment),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateAssignment(
    productTypeId: string,
    assignmentId: string,
    input: UpdateProductTypeAttributeAssignmentDto,
    actorId: string,
  ): Promise<ProductTypeAttributeAssignmentResponseDto> {
    if (!this.hasChanges(input)) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_UPDATE_EMPTY',
        message: 'At least one assignment field must be supplied',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current =
            await transaction.productTypeAttributeAssignment.findFirst({
              where: { id: assignmentId, productTypeId },
            });
          if (!current) throw this.assignmentNotFound();
          if (current.version !== input.version) {
            throw this.versionConflict();
          }

          const [productType, attribute] = await Promise.all([
            transaction.productType.findUnique({
              where: { id: productTypeId },
            }),
            transaction.attributeDefinition.findUnique({
              where: { id: current.attributeId },
            }),
          ]);

          if (!productType) throw this.productTypeNotFound();
          if (!attribute) throw this.attributeNotFound();
          this.assertProductAttributeScope(attribute.scope);

          const requirement = input.requirement ?? current.requirement;
          const conditionalRule =
            input.conditionalRule === undefined
              ? current.conditionalRule
              : input.conditionalRule;
          this.assertConditionalRule(requirement, conditionalRule);

          const validationRule =
            input.validationRule === undefined
              ? current.validationRule
              : input.validationRule;
          this.assertValidationRule(attribute, validationRule);

          const status = input.status ?? current.status;
          this.assertActiveParents(status, productType.status, attribute.status);

          const defaultUnitId =
            input.defaultUnitId === undefined
              ? current.defaultUnitId ?? attribute.defaultUnitId
              : input.defaultUnitId;
          await this.assertDefaultUnit(
            transaction,
            attribute,
            defaultUnitId,
            status,
          );

          const assignment =
            await transaction.productTypeAttributeAssignment.update({
              where: { id: assignmentId, version: input.version },
              data: {
                requirement: input.requirement,
                displayMode: input.displayMode,
                displayOrder: input.displayOrder,
                validationRule: this.jsonInput(input.validationRule),
                conditionalRule: this.jsonInput(input.conditionalRule),
                defaultUnitId,
                searchable: input.searchable,
                filterable: input.filterable,
                comparable: input.comparable,
                variantDefining: input.variantDefining,
                marketplaceVisible: input.marketplaceVisible,
                sellerEditable: input.sellerEditable,
                status: input.status,
                version: { increment: 1 },
                updatedById: actorId,
              },
            });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_ATTRIBUTE_UPDATED',
              entityType: 'ProductTypeAttributeAssignment',
              entityId: assignment.id,
              metadata: {
                before: this.assignmentSnapshot(current),
                after: this.assignmentSnapshot(assignment),
              },
            },
          });

          return this.toAssignmentResponse(assignment);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateAssignmentsBulk(
    productTypeId: string,
    input: BulkUpdateProductTypeAttributeAssignmentsDto,
    actorId: string,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    const ids = input.assignments.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_DUPLICATE_ASSIGNMENTS',
        message: 'Select each assigned Attribute only once',
      });
    }
    if (
      input.requirement === ProductTypeAttributeRequirement.CONDITIONAL
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_CONDITIONAL_UNSUPPORTED',
        message:
          'Conditional Attributes require individual rules and cannot be bulk updated',
      });
    }
    const settings = [
      'requirement', 'displayMode', 'displayOrder', 'searchable', 'filterable',
      'comparable', 'variantDefining', 'marketplaceVisible', 'sellerEditable',
    ] as const;
    const hasIndividualChanges = input.assignments.some((item) =>
      settings.some((setting) => item[setting] !== undefined),
    );
    if (
      !hasIndividualChanges &&
      input.requirement === undefined &&
      input.searchable === undefined &&
      input.filterable === undefined &&
      input.comparable === undefined
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_UPDATE_EMPTY',
        message: 'Choose at least one Attribute setting to change',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current =
            await transaction.productTypeAttributeAssignment.findMany({
              where: { productTypeId, id: { in: ids } },
            });

          if (current.length !== ids.length) {
            throw this.assignmentNotFound();
          }

          const versions = new Map(
            input.assignments.map((item) => [item.id, item.version]),
          );
          const stale = current.find(
            (assignment) => versions.get(assignment.id) !== assignment.version,
          );
          if (stale) throw this.versionConflict();

          // Bulk Save All must uphold the same canonical Attribute and
          // lifecycle checks as updateAssignment; a batch must never bypass
          // PRODUCT scope, Active parents or Unit Dimension validation.
          const attributeIds = [...new Set(current.map((item) => item.attributeId))];
          const [productType, attributes] = await Promise.all([
            transaction.productType.findUnique({ where: { id: productTypeId } }),
            transaction.attributeDefinition.findMany({
              where: { id: { in: attributeIds } },
            }),
          ]);
          if (!productType) throw this.productTypeNotFound();
          const attributesById = new Map(
            attributes.map((attribute) => [attribute.id, attribute]),
          );
          const defaultUnitIdsByAssignment = new Map<string, string | null>();
          const byId = new Map(input.assignments.map((item) => [item.id, item]));

          // Preflight every row before making the first write. The serializable
          // transaction also rolls back if a write or audit later fails.
          for (const assignment of current) {
            const attribute = attributesById.get(assignment.attributeId);
            if (!attribute) throw this.attributeNotFound();
            this.assertProductAttributeScope(attribute.scope);
            this.assertActiveParents(
              assignment.status,
              productType.status,
              attribute.status,
            );
            this.assertValidationRule(attribute, assignment.validationRule);
            const defaultUnitId =
              assignment.defaultUnitId ?? attribute.defaultUnitId;
            await this.assertDefaultUnit(
              transaction,
              attribute,
              defaultUnitId,
              assignment.status,
            );
            // Match updateAssignment: a valid master fallback must be saved on
            // the assignment, not just accepted during preflight validation.
            defaultUnitIdsByAssignment.set(assignment.id, defaultUnitId);
            const requested = byId.get(assignment.id)!;
            this.assertConditionalRule(
              requested.requirement ?? input.requirement ?? assignment.requirement,
              assignment.conditionalRule,
            );
          }

          const updated: ProductTypeAttributeAssignment[] = [];
          for (const assignment of current) {
            const requested = byId.get(assignment.id)!;
            const nextRequirement = requested.requirement ?? input.requirement;
            updated.push(
              await transaction.productTypeAttributeAssignment.update({
                where: { id: assignment.id, version: assignment.version },
                data: {
                  requirement: nextRequirement,
                  displayMode: requested.displayMode,
                  displayOrder: requested.displayOrder,
                  defaultUnitId: defaultUnitIdsByAssignment.get(assignment.id),
                  searchable: requested.searchable ?? input.searchable,
                  filterable: requested.filterable ?? input.filterable,
                  comparable: requested.comparable ?? input.comparable,
                  variantDefining: requested.variantDefining,
                  marketplaceVisible: requested.marketplaceVisible,
                  sellerEditable: requested.sellerEditable,
                  version: { increment: 1 },
                  updatedById: actorId,
                },
              }),
            );
          }

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_ATTRIBUTES_BULK_UPDATED',
              entityType: 'ProductType',
              entityId: productTypeId,
              metadata: {
                productTypeId,
                assignmentIds: ids,
                before: current.map((assignment) =>
                  this.assignmentSnapshot(assignment),
                ),
                after: updated.map((assignment) =>
                  this.assignmentSnapshot(assignment),
                ),
              },
            },
          });

          return updated.map((assignment) =>
            this.toAssignmentResponse(assignment),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async deleteAssignmentsBulk(
    productTypeId: string,
    input: BulkDeleteProductTypeAttributeAssignmentsDto,
    actorId: string,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    const ids = input.assignments.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_DUPLICATE_ASSIGNMENTS',
        message: 'Select each assigned Attribute only once',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current =
            await transaction.productTypeAttributeAssignment.findMany({
              where: { productTypeId, id: { in: ids } },
            });

          if (current.length !== ids.length) {
            throw this.assignmentNotFound();
          }

          const versions = new Map(
            input.assignments.map((item) => [item.id, item.version]),
          );
          const stale = current.find(
            (assignment) => versions.get(assignment.id) !== assignment.version,
          );
          if (stale) throw this.versionConflict();

          await transaction.productTypeAttributeAssignment.deleteMany({
            where: { productTypeId, id: { in: ids } },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_ATTRIBUTES_BULK_UNASSIGNED',
              entityType: 'ProductType',
              entityId: productTypeId,
              metadata: {
                assignmentIds: ids,
                attributeIds: current.map(
                  (assignment) => assignment.attributeId,
                ),
                before: current.map((assignment) =>
                  this.assignmentSnapshot(assignment),
                ),
              },
            },
          });

          return current.map((assignment) =>
            this.toAssignmentResponse(assignment),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async deleteAssignment(
    productTypeId: string,
    assignmentId: string,
    version: number,
    actorId: string,
  ): Promise<ProductTypeAttributeAssignmentResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current =
            await transaction.productTypeAttributeAssignment.findFirst({
              where: { id: assignmentId, productTypeId },
            });
          if (!current) throw this.assignmentNotFound();
          if (current.version !== version) {
            throw this.versionConflict();
          }

          const deleted =
            await transaction.productTypeAttributeAssignment.delete({
              where: { id: assignmentId, version },
            });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_ATTRIBUTE_UNASSIGNED',
              entityType: 'ProductTypeAttributeAssignment',
              entityId: deleted.id,
              metadata: {
                before: this.assignmentSnapshot(current),
              },
            },
          });

          return this.toAssignmentResponse(deleted);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private async requireProductType(productTypeId: string): Promise<void> {
    const productType = await this.database.productType.findUnique({
      where: { id: productTypeId },
      select: { id: true },
    });
    if (!productType) throw this.productTypeNotFound();
  }

  private assertConditionalRule(
    requirement: ProductTypeAttributeRequirement,
    conditionalRule: unknown,
  ): void {
    if (
      requirement === ProductTypeAttributeRequirement.CONDITIONAL &&
      !this.isJsonObject(conditionalRule)
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_CONDITION_REQUIRED',
        message: 'A conditional assignment requires a conditional rule object',
      });
    }
  }

  private assertValidationRule(
    attribute: AttributeDefinition,
    validationRule: unknown,
  ): void {
    if (
      validationRule !== null &&
      validationRule !== undefined &&
      !this.isJsonObject(validationRule)
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_VALIDATION_RULE_INVALID',
        message: 'Validation rules must be a JSON object',
      });
    }

    const inherited = this.isJsonObject(attribute.validationRule)
      ? attribute.validationRule
      : {};
    const override = this.isJsonObject(validationRule) ? validationRule : {};
    const effectiveRule = { ...inherited, ...override };
    if (Object.keys(effectiveRule).length === 0) return;

    const supportedKeys = new Set(['min', 'max', 'minLength', 'maxLength']);
    const unsupportedKeys = Object.keys(effectiveRule).filter(
      (key) => !supportedKeys.has(key),
    );
    if (unsupportedKeys.length > 0) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_VALIDATION_RULE_UNSUPPORTED',
        message:
          'Supported validation rules are min, max, minLength and maxLength',
        details: { unsupportedKeys },
      });
    }

    const numericTypes = new Set<AttributeDataType>([
      AttributeDataType.INTEGER,
      AttributeDataType.DECIMAL,
      AttributeDataType.MONEY,
      AttributeDataType.MEASUREMENT,
    ]);
    const lengthTypes = new Set<AttributeDataType>([
      AttributeDataType.TEXT,
      AttributeDataType.LONG_TEXT,
      AttributeDataType.COUNTRY,
      AttributeDataType.IMAGE,
      AttributeDataType.VIDEO,
      AttributeDataType.FILE,
      AttributeDataType.SELECT,
      AttributeDataType.DATE,
      AttributeDataType.DATETIME,
      AttributeDataType.UUID,
      AttributeDataType.REFERENCE,
      AttributeDataType.MULTI_SELECT,
      AttributeDataType.MULTI_REFERENCE,
      AttributeDataType.MULTI_IMAGE,
    ]);

    const min = effectiveRule.min;
    const max = effectiveRule.max;
    const minLength = effectiveRule.minLength;
    const maxLength = effectiveRule.maxLength;

    if (min !== undefined || max !== undefined) {
      if (!numericTypes.has(attribute.dataType)) {
        throw new BadRequestException({
          code: 'PRODUCT_TYPE_ATTRIBUTE_NUMERIC_RULE_NOT_ALLOWED',
          message: 'Minimum/maximum values apply only to numeric or measurement Attributes',
        });
      }
      if (
        (min !== undefined && (typeof min !== 'number' || !Number.isFinite(min))) ||
        (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max)))
      ) {
        throw new BadRequestException({
          code: 'PRODUCT_TYPE_ATTRIBUTE_NUMERIC_RULE_INVALID',
          message: 'Minimum and maximum must be finite numbers',
        });
      }
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        throw new BadRequestException({
          code: 'PRODUCT_TYPE_ATTRIBUTE_NUMERIC_RANGE_INVALID',
          message: 'Minimum cannot be greater than maximum',
        });
      }
    }

    if (minLength !== undefined || maxLength !== undefined) {
      if (!lengthTypes.has(attribute.dataType)) {
        throw new BadRequestException({
          code: 'PRODUCT_TYPE_ATTRIBUTE_LENGTH_RULE_NOT_ALLOWED',
          message:
            'Length limits apply only to text or multi-value Attributes',
        });
      }
      for (const [label, value] of [
        ['Minimum length', minLength],
        ['Maximum length', maxLength],
      ] as const) {
        if (
          value !== undefined &&
          (!Number.isInteger(value) || (value as number) < 0)
        ) {
          throw new BadRequestException({
            code: 'PRODUCT_TYPE_ATTRIBUTE_LENGTH_RULE_INVALID',
            message: `${label} must be a non-negative integer`,
          });
        }
      }
      if (
        typeof minLength === 'number' &&
        typeof maxLength === 'number' &&
        minLength > maxLength
      ) {
        throw new BadRequestException({
          code: 'PRODUCT_TYPE_ATTRIBUTE_LENGTH_RANGE_INVALID',
          message: 'Minimum length cannot be greater than maximum length',
        });
      }
    }
  }

  private assertProductAttributeScope(scope: AttributeScope): void {
    if (scope !== AttributeScope.PRODUCT) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_SCOPE_INVALID',
        message: 'Product Types can use only PRODUCT-scope Technical Attributes',
      });
    }
  }

  private assertActiveParents(
    status: MasterDataStatus,
    productTypeStatus: MasterDataStatus,
    attributeStatus: MasterDataStatus,
  ): void {
    if (status !== MasterDataStatus.ACTIVE) return;

    if (productTypeStatus !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_PRODUCT_TYPE_NOT_ACTIVE',
        message: 'An active assignment requires an active Product Type',
      });
    }

    if (attributeStatus !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_ATTRIBUTE_NOT_ACTIVE',
        message: 'An active assignment requires an active Attribute',
      });
    }
  }

  private async assertDefaultUnit(
    transaction: Prisma.TransactionClient,
    attribute: AttributeDefinition,
    defaultUnitId: string | null,
    assignmentStatus: MasterDataStatus,
  ): Promise<void> {
    if (
      assignmentStatus === MasterDataStatus.ACTIVE &&
      attribute.unitDimensionId &&
      !defaultUnitId
    ) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_DEFAULT_UNIT_REQUIRED',
        message:
          'An active unit-based Attribute assignment requires a default Unit from its Unit Dimension',
      });
    }

    if (!defaultUnitId) return;

    if (!attribute.unitDimensionId) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_UNIT_NOT_ALLOWED',
        message: 'This Attribute does not use a Unit Dimension',
      });
    }

    const unit = await transaction.attributeUnit.findUnique({
      where: { id: defaultUnitId },
      select: {
        id: true,
        dimensionId: true,
        status: true,
      },
    });

    if (!unit || unit.dimensionId !== attribute.unitDimensionId) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_UNIT_DIMENSION_MISMATCH',
        message:
          'The selected default Unit must belong to the Attribute Unit Dimension',
      });
    }

    if (
      assignmentStatus === MasterDataStatus.ACTIVE &&
      unit.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_UNIT_NOT_ACTIVE',
        message: 'An active assignment requires an active default Unit',
      });
    }
  }

  private jsonInput(
    value: Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private isJsonObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  private hasChanges(input: UpdateProductTypeAttributeAssignmentDto): boolean {
    return (
      input.requirement !== undefined ||
      input.displayMode !== undefined ||
      input.displayOrder !== undefined ||
      input.validationRule !== undefined ||
      input.conditionalRule !== undefined ||
      input.defaultUnitId !== undefined ||
      input.searchable !== undefined ||
      input.filterable !== undefined ||
      input.comparable !== undefined ||
      input.variantDefining !== undefined ||
      input.marketplaceVisible !== undefined ||
      input.sellerEditable !== undefined ||
      input.status !== undefined
    );
  }

  private assignmentSnapshot(
    assignment: ProductTypeAttributeAssignment,
  ): Prisma.InputJsonObject {
    return {
      id: assignment.id,
      productTypeId: assignment.productTypeId,
      attributeId: assignment.attributeId,
      requirement: assignment.requirement,
      displayMode: assignment.displayMode,
      displayOrder: assignment.displayOrder,
      validationRule:
        assignment.validationRule === null
          ? null
          : (assignment.validationRule as Prisma.InputJsonValue),
      conditionalRule:
        assignment.conditionalRule === null
          ? null
          : (assignment.conditionalRule as Prisma.InputJsonValue),
      defaultUnitId: assignment.defaultUnitId,
      searchable: assignment.searchable,
      filterable: assignment.filterable,
      comparable: assignment.comparable,
      variantDefining: assignment.variantDefining,
      marketplaceVisible: assignment.marketplaceVisible,
      sellerEditable: assignment.sellerEditable,
      status: assignment.status,
      version: assignment.version,
    };
  }

  private toAssignmentResponse(
    assignment: ProductTypeAttributeAssignment,
  ): ProductTypeAttributeAssignmentResponseDto {
    return {
      id: assignment.id,
      productTypeId: assignment.productTypeId,
      attributeId: assignment.attributeId,
      requirement: assignment.requirement,
      displayMode: assignment.displayMode,
      displayOrder: assignment.displayOrder,
      validationRule: assignment.validationRule,
      conditionalRule: assignment.conditionalRule,
      defaultUnitId: assignment.defaultUnitId,
      searchable: assignment.searchable,
      filterable: assignment.filterable,
      comparable: assignment.comparable,
      variantDefining: assignment.variantDefining,
      marketplaceVisible: assignment.marketplaceVisible,
      sellerEditable: assignment.sellerEditable,
      status: assignment.status,
      version: assignment.version,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private productTypeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_TYPE_NOT_FOUND',
      message: 'Product Type was not found',
    });
  }

  private attributeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ATTRIBUTE_NOT_FOUND',
      message: 'Attribute definition was not found',
    });
  }

  private assignmentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_TYPE_ATTRIBUTE_NOT_FOUND',
      message: 'Product Type attribute assignment was not found',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'PRODUCT_TYPE_ATTRIBUTE_VERSION_CONFLICT',
      message: 'The assignment changed; reload it before trying again',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ATTRIBUTE_ALREADY_ASSIGNED',
        message: 'The Attribute is already assigned to this Product Type',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.versionConflict();
    }
    throw error;
  }
}
