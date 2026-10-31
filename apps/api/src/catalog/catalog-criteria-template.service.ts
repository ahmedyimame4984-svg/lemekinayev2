import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttributeScope,
  MasterDataStatus,
  Prisma,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  type AttributeDefinition,
  type ProductTypeCriteriaTemplate,
  type ProductTypeCriteriaTemplateItem,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  AttributeDefinitionPageResponseDto,
  AttributeDefinitionSummaryResponseDto,
} from './dto/attribute.dto.js';
import type {
  ApplyCriteriaTemplateDto,
  AvailableCriteriaTemplateAttributePageQueryDto,
  BulkCreateCriteriaTemplateItemsDto,
  CreateCriteriaTemplateDto,
  CreateCriteriaTemplateItemDto,
  CriteriaTemplateAdminPageQueryDto,
  CriteriaTemplateAdminQueryDto,
  CriteriaTemplateApplyResponseDto,
  CriteriaTemplatePageResponseDto,
  CriteriaTemplateItemResponseDto,
  CriteriaTemplateResponseDto,
  UpdateCriteriaTemplateDto,
  UpdateCriteriaTemplateItemDto,
} from './dto/criteria-template.dto.js';

const templateSelect = {
  id: true,
  productFamilyId: true,
  code: true,
  name: true,
  description: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.ProductTypeCriteriaTemplateSelect;

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

const itemSelect = {
  id: true,
  templateId: true,
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
} satisfies Prisma.ProductTypeCriteriaTemplateItemSelect;

type TemplateView = Prisma.ProductTypeCriteriaTemplateGetPayload<{
  select: typeof templateSelect;
}>;

@Injectable()
export class CatalogCriteriaTemplateService {
  constructor(private readonly database: DatabaseService) {}

  async listTemplates(
    query: CriteriaTemplateAdminQueryDto,
  ): Promise<CriteriaTemplateResponseDto[]> {
    let productType:
      | { id: string; productFamilyId: string | null }
      | null = null;

    if (query.productTypeId) {
      productType = await this.database.productType.findUnique({
        where: { id: query.productTypeId },
        select: { id: true, productFamilyId: true },
      });
      if (!productType) {
        throw new NotFoundException({
          code: 'PRODUCT_TYPE_NOT_FOUND',
          message: 'Product Type was not found',
        });
      }
    }

    const familyId = productType?.productFamilyId ?? query.productFamilyId;

    const records = await this.database.productTypeCriteriaTemplate.findMany({
      where: {
        status: query.status,
        OR: productType
          ? [
              {
                targets: {
                  some: { productTypeId: productType.id },
                },
              },
              ...(familyId ? [{ productFamilyId: familyId }] : []),
              {
                productFamilyId: null,
                targets: { none: {} },
              },
            ]
          : familyId
            ? [
                { productFamilyId: familyId },
                {
                  productFamilyId: null,
                  targets: { none: {} },
                },
              ]
            : undefined,
      },
      select: templateSelect,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
    return records.map((record) => this.toTemplateResponse(record));
  }

  async listTemplatesPage(
    query: CriteriaTemplateAdminPageQueryDto,
  ): Promise<CriteriaTemplatePageResponseDto> {
    let productType:
      | { id: string; productFamilyId: string | null }
      | null = null;

    if (query.productTypeId) {
      productType = await this.database.productType.findUnique({
        where: { id: query.productTypeId },
        select: { id: true, productFamilyId: true },
      });
      if (!productType) {
        throw new NotFoundException({
          code: 'PRODUCT_TYPE_NOT_FOUND',
          message: 'Product Type was not found',
        });
      }
    }

    const familyId = productType?.productFamilyId ?? query.productFamilyId;
    const applicability = productType
      ? [
          {
            targets: {
              some: { productTypeId: productType.id },
            },
          },
          ...(familyId ? [{ productFamilyId: familyId }] : []),
          {
            productFamilyId: null,
            targets: { none: {} },
          },
        ]
      : familyId
        ? [
            { productFamilyId: familyId },
            {
              productFamilyId: null,
              targets: { none: {} },
            },
          ]
        : null;
    const search = query.search?.trim();
    const searchCriteria = search
      ? [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ]
      : null;

    const where: Prisma.ProductTypeCriteriaTemplateWhereInput = {
      status: query.status,
      ...(applicability && searchCriteria
        ? {
            AND: [{ OR: applicability }, { OR: searchCriteria }],
          }
        : applicability
          ? { OR: applicability }
          : searchCriteria
            ? { OR: searchCriteria }
            : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const [total, records] = await Promise.all([
      this.database.productTypeCriteriaTemplate.count({ where }),
      this.database.productTypeCriteriaTemplate.findMany({
        where,
        select: templateSelect,
        orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.toTemplateResponse(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async createTemplate(
    input: CreateCriteriaTemplateDto,
    actorId: string,
  ): Promise<CriteriaTemplateResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const status = input.status ?? MasterDataStatus.DRAFT;
          await this.assertFamily(tx, input.productFamilyId ?? null, status);

          const record = await tx.productTypeCriteriaTemplate.create({
            data: {
              productFamilyId: input.productFamilyId ?? null,
              code: input.code,
              name: input.name.trim(),
              description: this.optionalText(input.description),
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: templateSelect,
          });

          await this.audit(
            tx,
            actorId,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_CREATED',
            'ProductTypeCriteriaTemplate',
            record.id,
            { after: this.templateSnapshot(record) },
          );

          return this.toTemplateResponse(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(
        error,
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ALREADY_EXISTS',
        'Criteria Template code must be unique',
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_VERSION_CONFLICT',
      );
    }
  }

  async updateTemplate(
    templateId: string,
    input: UpdateCriteriaTemplateDto,
    actorId: string,
  ): Promise<CriteriaTemplateResponseDto> {
    this.assertChanges(
      input,
      ['name', 'productFamilyId', 'description', 'status'],
      'PRODUCT_TYPE_CRITERIA_TEMPLATE_UPDATE_EMPTY',
    );

    try {
      return await this.database.$transaction(
        async (tx) => {
          const current =
            await tx.productTypeCriteriaTemplate.findUnique({
              where: { id: templateId },
              include: {
                _count: { select: { items: true } },
              },
            });
          if (!current) throw this.templateNotFound();
          this.assertVersion(
            current.version,
            input.version,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_VERSION_CONFLICT',
          );

          const nextStatus = input.status ?? current.status;
          const nextFamilyId =
            input.productFamilyId === undefined
              ? current.productFamilyId
              : input.productFamilyId;
          await this.assertFamily(tx, nextFamilyId, nextStatus);

          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const activeItem =
              await tx.productTypeCriteriaTemplateItem.findFirst({
                where: {
                  templateId,
                  status: MasterDataStatus.ACTIVE,
                },
                select: { id: true },
              });
            if (activeItem) {
              throw new ConflictException({
                code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_HAS_ACTIVE_ITEMS',
                message:
                  'Deactivate active template criteria before deactivating the Template',
              });
            }
          }

          const record = await tx.productTypeCriteriaTemplate.update({
            where: { id: templateId, version: input.version },
            data: {
              name: input.name?.trim(),
              productFamilyId: input.productFamilyId,
              description:
                input.description === undefined
                  ? undefined
                  : this.optionalText(input.description),
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: templateSelect,
          });

          await this.audit(
            tx,
            actorId,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_UPDATED',
            'ProductTypeCriteriaTemplate',
            record.id,
            {
              before: this.templateSnapshot(current),
              after: this.templateSnapshot(record),
            },
          );

          return this.toTemplateResponse(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(
        error,
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ALREADY_EXISTS',
        'Criteria Template code must be unique',
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_VERSION_CONFLICT',
      );
    }
  }

  async listItems(
    templateId: string,
  ): Promise<CriteriaTemplateItemResponseDto[]> {
    await this.requireTemplate(templateId);
    return this.database.productTypeCriteriaTemplateItem.findMany({
      where: { templateId },
      select: itemSelect,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listAvailableAttributesPage(
    templateId: string,
    query: AvailableCriteriaTemplateAttributePageQueryDto,
  ): Promise<AttributeDefinitionPageResponseDto> {
    await this.requireTemplate(templateId);

    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.AttributeDefinitionWhereInput = {
      status: MasterDataStatus.ACTIVE,
      scope: AttributeScope.PRODUCT,
      groupId: query.ungrouped ? null : query.groupId,
      criteriaTemplateItems: {
        none: { templateId },
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
    templateId: string,
  ): Promise<AttributeDefinitionSummaryResponseDto> {
    await this.requireTemplate(templateId);

    const grouped = await this.database.attributeDefinition.groupBy({
      by: ['groupId'],
      where: {
        status: MasterDataStatus.ACTIVE,
        scope: AttributeScope.PRODUCT,
        criteriaTemplateItems: {
          none: { templateId },
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

  async createItem(
    templateId: string,
    input: CreateCriteriaTemplateItemDto,
    actorId: string,
  ): Promise<CriteriaTemplateItemResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const [template, attribute] = await Promise.all([
            tx.productTypeCriteriaTemplate.findUnique({
              where: { id: templateId },
            }),
            tx.attributeDefinition.findUnique({
              where: { id: input.attributeId },
            }),
          ]);
          if (!template) throw this.templateNotFound();
          if (!attribute) throw this.attributeNotFound();

          const requirement =
            input.requirement ?? ProductTypeAttributeRequirement.OPTIONAL;
          this.assertConditionalRule(requirement, input.conditionalRule);

          const status = input.status ?? MasterDataStatus.DRAFT;
          this.assertActiveTemplateItemParents(
            status,
            template.status,
            attribute.status,
          );

          const defaultUnitId =
            input.defaultUnitId === undefined
              ? attribute.defaultUnitId
              : input.defaultUnitId;
          await this.assertDefaultUnit(
            tx,
            attribute,
            defaultUnitId,
            status,
          );

          const record = await tx.productTypeCriteriaTemplateItem.create({
            data: {
              templateId,
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

          await this.audit(
            tx,
            actorId,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_CREATED',
            'ProductTypeCriteriaTemplateItem',
            record.id,
            { after: this.itemSnapshot(record) },
          );

          return this.toItemResponse(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(
        error,
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ATTRIBUTE_DUPLICATE',
        'The Attribute is already present in this Criteria Template',
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_VERSION_CONFLICT',
      );
    }
  }

  async createItemsBulk(
    templateId: string,
    input: BulkCreateCriteriaTemplateItemsDto,
    actorId: string,
  ): Promise<CriteriaTemplateItemResponseDto[]> {
    const attributeIds = [...new Set(input.attributeIds)];
    if (attributeIds.length !== input.attributeIds.length) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_BULK_DUPLICATE_IDS',
        message: 'Select each Attribute only once',
      });
    }

    const requirement =
      input.requirement ?? ProductTypeAttributeRequirement.OPTIONAL;
    if (requirement === ProductTypeAttributeRequirement.CONDITIONAL) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_BULK_CONDITIONAL_UNSUPPORTED',
        message:
          'Conditional criteria require individual rules and cannot be bulk added',
      });
    }

    try {
      return await this.database.$transaction(
        async (tx) => {
          const [template, attributes, existing] = await Promise.all([
            tx.productTypeCriteriaTemplate.findUnique({
              where: { id: templateId },
            }),
            tx.attributeDefinition.findMany({
              where: { id: { in: attributeIds } },
            }),
            tx.productTypeCriteriaTemplateItem.findMany({
              where: {
                templateId,
                attributeId: { in: attributeIds },
              },
              select: { attributeId: true },
            }),
          ]);

          if (!template) throw this.templateNotFound();
          if (attributes.length !== attributeIds.length) {
            const found = new Set(attributes.map((attribute) => attribute.id));
            throw new NotFoundException({
              code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_BULK_ATTRIBUTE_NOT_FOUND',
              message: 'One or more selected Attributes were not found',
              details: {
                missingAttributeIds: attributeIds.filter((id) => !found.has(id)),
              },
            });
          }
          if (existing.length > 0) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_ATTRIBUTE_DUPLICATE',
              message:
                'One or more selected Attributes already exist in this Template',
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
          const created: ProductTypeCriteriaTemplateItem[] = [];

          for (const [index, attributeId] of attributeIds.entries()) {
            const attribute = byId.get(attributeId);
            if (!attribute) throw this.attributeNotFound();

            this.assertActiveTemplateItemParents(
              status,
              template.status,
              attribute.status,
            );
            await this.assertDefaultUnit(
              tx,
              attribute,
              attribute.defaultUnitId,
              status,
            );

            const record = await tx.productTypeCriteriaTemplateItem.create({
              data: {
                templateId,
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
            created.push(record);
          }

          await this.audit(
            tx,
            actorId,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEMS_BULK_CREATED',
            'ProductTypeCriteriaTemplate',
            templateId,
            {
              templateId,
              attributeIds,
              itemIds: created.map((item) => item.id),
              count: created.length,
              requirement,
              status,
            },
          );

          return created.map((item) => this.toItemResponse(item));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(
        error,
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ATTRIBUTE_DUPLICATE',
        'One or more selected Attributes already exist in this Template',
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_VERSION_CONFLICT',
      );
    }
  }

  async updateItem(
    templateId: string,
    itemId: string,
    input: UpdateCriteriaTemplateItemDto,
    actorId: string,
  ): Promise<CriteriaTemplateItemResponseDto> {
    this.assertChanges(
      input,
      [
        'requirement',
        'displayMode',
        'displayOrder',
        'validationRule',
        'conditionalRule',
        'defaultUnitId',
        'searchable',
        'filterable',
        'comparable',
        'variantDefining',
        'marketplaceVisible',
        'sellerEditable',
        'status',
      ],
      'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_UPDATE_EMPTY',
    );

    try {
      return await this.database.$transaction(
        async (tx) => {
          const current =
            await tx.productTypeCriteriaTemplateItem.findFirst({
              where: { id: itemId, templateId },
            });
          if (!current) throw this.itemNotFound();
          this.assertVersion(
            current.version,
            input.version,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_VERSION_CONFLICT',
          );

          const [template, attribute] = await Promise.all([
            tx.productTypeCriteriaTemplate.findUnique({
              where: { id: templateId },
            }),
            tx.attributeDefinition.findUnique({
              where: { id: current.attributeId },
            }),
          ]);
          if (!template) throw this.templateNotFound();
          if (!attribute) throw this.attributeNotFound();

          const requirement = input.requirement ?? current.requirement;
          const conditionalRule =
            input.conditionalRule === undefined
              ? current.conditionalRule
              : input.conditionalRule;
          this.assertConditionalRule(requirement, conditionalRule);

          const status = input.status ?? current.status;
          this.assertActiveTemplateItemParents(
            status,
            template.status,
            attribute.status,
          );

          const defaultUnitId =
            input.defaultUnitId === undefined
              ? current.defaultUnitId
              : input.defaultUnitId;
          await this.assertDefaultUnit(
            tx,
            attribute,
            defaultUnitId,
            status,
          );

          const record = await tx.productTypeCriteriaTemplateItem.update({
            where: { id: itemId, version: input.version },
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

          await this.audit(
            tx,
            actorId,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_UPDATED',
            'ProductTypeCriteriaTemplateItem',
            record.id,
            {
              before: this.itemSnapshot(current),
              after: this.itemSnapshot(record),
            },
          );

          return this.toItemResponse(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(
        error,
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ATTRIBUTE_DUPLICATE',
        'The Attribute is already present in this Criteria Template',
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_VERSION_CONFLICT',
      );
    }
  }

  async applyTemplate(
    productTypeId: string,
    templateId: string,
    input: ApplyCriteriaTemplateDto,
    actorId: string,
  ): Promise<CriteriaTemplateApplyResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const [productType, template] = await Promise.all([
            tx.productType.findUnique({
              where: { id: productTypeId },
              select: {
                id: true,
                productFamilyId: true,
                status: true,
              },
            }),
            tx.productTypeCriteriaTemplate.findUnique({
              where: { id: templateId },
              include: {
                items: {
                  where: { status: MasterDataStatus.ACTIVE },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                  include: { attribute: true },
                },
              },
            }),
          ]);

          if (!productType) {
            throw new NotFoundException({
              code: 'PRODUCT_TYPE_NOT_FOUND',
              message: 'Product Type was not found',
            });
          }
          if (!template) throw this.templateNotFound();
          if (template.status !== MasterDataStatus.ACTIVE) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_NOT_ACTIVE',
              message: 'Only an active Criteria Template can be applied',
            });
          }
          if (
            template.productFamilyId &&
            productType.productFamilyId !== template.productFamilyId
          ) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_FAMILY_MISMATCH',
              message:
                'This Criteria Template belongs to a different Product Family',
            });
          }
          if (template.items.length === 0) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_EMPTY',
              message: 'The Criteria Template has no active criteria to apply',
            });
          }

          const attributeIds = template.items.map((item) => item.attributeId);
          const existing =
            await tx.productTypeAttributeAssignment.findMany({
              where: {
                productTypeId,
                attributeId: { in: attributeIds },
              },
              select: { attributeId: true, displayOrder: true },
            });
          const existingIds = new Set(
            existing.map((item) => item.attributeId),
          );
          const existingOrders =
            await tx.productTypeAttributeAssignment.findMany({
              where: { productTypeId },
              select: { displayOrder: true },
            });

          const startDisplayOrder =
            input.startDisplayOrder ??
            (existingOrders.length === 0
              ? 0
              : Math.max(
                  ...existingOrders.map((item) => item.displayOrder),
                ) + 10);

          const assignmentStatus =
            input.assignmentStatus ?? MasterDataStatus.DRAFT;
          if (
            assignmentStatus === MasterDataStatus.ACTIVE &&
            productType.status !== MasterDataStatus.ACTIVE
          ) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_PRODUCT_TYPE_NOT_ACTIVE',
              message:
                'Active template application requires an active Product Type',
            });
          }

          const createdIds: string[] = [];
          const firstTemplateOrder = template.items[0]?.displayOrder ?? 0;

          for (const item of template.items) {
            if (existingIds.has(item.attributeId)) continue;

            this.assertConditionalRule(
              item.requirement,
              item.conditionalRule,
            );
            this.assertActiveTemplateItemParents(
              MasterDataStatus.ACTIVE,
              template.status,
              item.attribute.status,
            );
            await this.assertDefaultUnit(
              tx,
              item.attribute,
              item.defaultUnitId,
              assignmentStatus,
            );

            const assignment =
              await tx.productTypeAttributeAssignment.create({
                data: {
                  productTypeId,
                  attributeId: item.attributeId,
                  requirement: item.requirement,
                  displayMode: item.displayMode,
                  displayOrder:
                    startDisplayOrder +
                    Math.max(0, item.displayOrder - firstTemplateOrder),
                  validationRule:
                    item.validationRule === null
                      ? undefined
                      : (item.validationRule as Prisma.InputJsonValue),
                  conditionalRule:
                    item.conditionalRule === null
                      ? undefined
                      : (item.conditionalRule as Prisma.InputJsonValue),
                  defaultUnitId: item.defaultUnitId,
                  searchable: item.searchable,
                  filterable: item.filterable,
                  comparable: item.comparable,
                  variantDefining: item.variantDefining,
                  marketplaceVisible: item.marketplaceVisible,
                  sellerEditable: item.sellerEditable,
                  status: assignmentStatus,
                  createdById: actorId,
                  updatedById: actorId,
                },
              });
            createdIds.push(assignment.id);
          }

          const skippedAttributeIds = attributeIds.filter((id) =>
            existingIds.has(id),
          );

          await this.audit(
            tx,
            actorId,
            'PRODUCT_TYPE_CRITERIA_TEMPLATE_APPLIED',
            'ProductType',
            productTypeId,
            {
              templateId,
              productTypeId,
              assignmentStatus,
              createdCount: createdIds.length,
              createdAssignmentIds: createdIds,
              skippedAttributeIds,
            },
          );

          return {
            templateId,
            productTypeId,
            createdCount: createdIds.length,
            createdAssignmentIds: createdIds,
            skippedAttributeIds,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(
        error,
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_APPLY_CONFLICT',
        'Criteria Template could not be applied',
        'PRODUCT_TYPE_CRITERIA_TEMPLATE_APPLY_CONFLICT',
      );
    }
  }

  private async requireTemplate(templateId: string): Promise<void> {
    const record = await this.database.productTypeCriteriaTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!record) throw this.templateNotFound();
  }

  private async assertFamily(
    tx: Prisma.TransactionClient,
    productFamilyId: string | null,
    status: MasterDataStatus,
  ): Promise<void> {
    if (!productFamilyId) return;
    const family = await tx.productFamily.findUnique({
      where: { id: productFamilyId },
      select: { id: true, status: true },
    });
    if (!family) {
      throw new NotFoundException({
        code: 'PRODUCT_FAMILY_NOT_FOUND',
        message: 'Product Family was not found',
      });
    }
    if (
      status === MasterDataStatus.ACTIVE &&
      family.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_FAMILY_NOT_ACTIVE',
        message:
          'An active Criteria Template requires an active Product Family',
      });
    }
  }

  private assertActiveTemplateItemParents(
    status: MasterDataStatus,
    templateStatus: MasterDataStatus,
    attributeStatus: MasterDataStatus,
  ): void {
    if (status !== MasterDataStatus.ACTIVE) return;
    if (templateStatus !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_NOT_ACTIVE',
        message: 'An active criterion requires an active Criteria Template',
      });
    }
    if (attributeStatus !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_ATTRIBUTE_NOT_ACTIVE',
        message: 'An active criterion requires an active Attribute',
      });
    }
  }

  private async assertDefaultUnit(
    tx: Prisma.TransactionClient,
    attribute: AttributeDefinition,
    defaultUnitId: string | null,
    status: MasterDataStatus,
  ): Promise<void> {
    if (!defaultUnitId) return;
    if (!attribute.unitDimensionId) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_UNIT_NOT_ALLOWED',
        message: 'This Attribute does not use a Unit Dimension',
      });
    }

    const unit = await tx.attributeUnit.findUnique({
      where: { id: defaultUnitId },
      select: { dimensionId: true, status: true },
    });
    if (!unit || unit.dimensionId !== attribute.unitDimensionId) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_UNIT_DIMENSION_MISMATCH',
        message:
          'The default Unit must belong to the Attribute Unit Dimension',
      });
    }
    if (
      status === MasterDataStatus.ACTIVE &&
      unit.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_UNIT_NOT_ACTIVE',
        message: 'An active criterion requires an active default Unit',
      });
    }
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
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_CONDITION_REQUIRED',
        message:
          'A conditional criterion requires an explicit conditional rule',
      });
    }
  }

  private assertChanges(
    input: object,
    fields: string[],
    code: string,
  ): void {
    if (
      !fields.some(
        (field) =>
          (input as Record<string, unknown>)[field] !== undefined,
      )
    ) {
      throw new BadRequestException({
        code,
        message: 'At least one mutable field must be supplied',
      });
    }
  }

  private assertVersion(
    actual: number,
    expected: number,
    code: string,
  ): void {
    if (actual !== expected) {
      throw new ConflictException({
        code,
        message: 'The record changed; reload it before trying again',
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

  private optionalText(value: string | null | undefined): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private isJsonObject(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  private audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<unknown> {
    return tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  }

  private templateSnapshot(
    record: ProductTypeCriteriaTemplate | TemplateView,
  ): Prisma.InputJsonObject {
    return {
      id: record.id,
      productFamilyId: record.productFamilyId,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
      version: record.version,
    };
  }

  private itemSnapshot(
    record: ProductTypeCriteriaTemplateItem,
  ): Prisma.InputJsonObject {
    return {
      id: record.id,
      templateId: record.templateId,
      attributeId: record.attributeId,
      requirement: record.requirement,
      displayMode: record.displayMode,
      displayOrder: record.displayOrder,
      defaultUnitId: record.defaultUnitId,
      searchable: record.searchable,
      filterable: record.filterable,
      comparable: record.comparable,
      variantDefining: record.variantDefining,
      marketplaceVisible: record.marketplaceVisible,
      sellerEditable: record.sellerEditable,
      status: record.status,
      version: record.version,
    };
  }

  private toTemplateResponse(
    record: TemplateView,
  ): CriteriaTemplateResponseDto {
    return {
      id: record.id,
      productFamilyId: record.productFamilyId,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
      version: record.version,
      itemCount: record._count.items,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toItemResponse(
    record: ProductTypeCriteriaTemplateItem,
  ): CriteriaTemplateItemResponseDto {
    return {
      id: record.id,
      templateId: record.templateId,
      attributeId: record.attributeId,
      requirement: record.requirement,
      displayMode: record.displayMode,
      displayOrder: record.displayOrder,
      validationRule: record.validationRule,
      conditionalRule: record.conditionalRule,
      defaultUnitId: record.defaultUnitId,
      searchable: record.searchable,
      filterable: record.filterable,
      comparable: record.comparable,
      variantDefining: record.variantDefining,
      marketplaceVisible: record.marketplaceVisible,
      sellerEditable: record.sellerEditable,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private templateNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_NOT_FOUND',
      message: 'Criteria Template was not found',
    });
  }

  private attributeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ATTRIBUTE_NOT_FOUND',
      message: 'Attribute definition was not found',
    });
  }

  private itemNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEM_NOT_FOUND',
      message: 'Criteria Template item was not found',
    });
  }

  private rethrow(
    error: unknown,
    duplicateCode: string,
    duplicateMessage: string,
    versionCode: string,
  ): never {
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
        code: duplicateCode,
        message: duplicateMessage,
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw new ConflictException({
        code: versionCode,
        message: 'The record changed; reload it before trying again',
      });
    }
    throw error;
  }
}
