import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  Prisma,
  type AttributeAllowedValue,
  type AttributeDefinition,
} from '@prisma/client';
import { validateSync } from 'class-validator';
import { AdminSortDirection } from '../common/admin-sort.js';
import {
  assertDirectMasterStatusChange,
  assertMasterCreateStatusAllowed,
  assertMasterRecordEditable,
} from '../common/master-data-lifecycle-policy.js';
import { DatabaseService } from '../database/database.service.js';
import { parseCsv, stringifyCsv } from '../common/admin-csv.js';
import { nonTechnicalAttributeReason } from './catalog-attribute-policy.js';
import {
  AttributeAdminSortBy,
  CreateAttributeDefinitionDto,
} from './dto/attribute.dto.js';
import type {
  AttributeAdminPageQueryDto,
  AttributeAdminQueryDto,
  AttributeAllowedValueAdminQueryDto,
  AttributeAllowedValueResponseDto,
  AttributeDefinitionPageResponseDto,
  AttributeDefinitionResponseDto,
  AttributeDefinitionSummaryResponseDto,
  CreateAttributeAllowedValueDto,
  UpdateAttributeAllowedValueDto,
  UpdateAttributeDefinitionDto,
} from './dto/attribute.dto.js';
import type {
  AttributeCsvExportQueryDto,
  AttributeCsvExportResponseDto,
  AttributeCsvImportCommitResponseDto,
  AttributeCsvImportPreviewResponseDto,
  AttributeCsvImportPreviewRowDto,
  AttributeCsvImportRequestDto,
} from './dto/attribute-import-export.dto.js';

const ATTRIBUTE_CSV_HEADERS = [
  'code',
  'name',
  'groupCode',
  'dataType',
  'scope',
  'valueSource',
  'unit',
  'description',
  'exampleValue',
  'repeatable',
  'translatable',
  'status',
] as const;
const ATTRIBUTE_CSV_REQUIRED_HEADERS = ['code', 'name', 'dataType', 'scope'] as const;
const MAX_ATTRIBUTE_IMPORT_ROWS = 2_000;

type PreparedAttributeImportRow = {
  preview: AttributeCsvImportPreviewRowDto;
  input: CreateAttributeDefinitionDto;
};

const attributeSelect = {
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

const allowedValueSelect = {
  id: true,
  attributeId: true,
  code: true,
  label: true,
  description: true,
  sortOrder: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeAllowedValueSelect;

@Injectable()
export class CatalogAttributeService {
  constructor(private readonly database: DatabaseService) {}

  listAdminAttributes(
    query: AttributeAdminQueryDto,
  ): Promise<AttributeDefinitionResponseDto[]> {
    return this.database.attributeDefinition.findMany({
      where: {
        groupId: query.groupId,
        status: query.status,
        dataType: query.dataType,
        scope: query.scope,
        valueSource: query.valueSource,
      },
      select: attributeSelect,
      orderBy: [{ code: 'asc' }],
    });
  }

  async listAdminAttributesPage(
    query: AttributeAdminPageQueryDto,
  ): Promise<AttributeDefinitionPageResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.attributeWhere(query);
    const orderBy = this.attributeOrderBy(query.sortBy, query.sortDirection);

    const [total, items] = await Promise.all([
      this.database.attributeDefinition.count({ where }),
      this.database.attributeDefinition.findMany({
        where,
        select: attributeSelect,
        orderBy,
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

  async exportAttributesCsv(
    query: AttributeCsvExportQueryDto,
  ): Promise<AttributeCsvExportResponseDto> {
    const attributes = await this.database.attributeDefinition.findMany({
      where: this.attributeWhere(query),
      select: attributeSelect,
      orderBy: this.attributeOrderBy(query.sortBy, query.sortDirection),
    });
    const groupIds = [
      ...new Set(
        attributes
          .map((attribute) => attribute.groupId)
          .filter((groupId): groupId is string => Boolean(groupId)),
      ),
    ];
    const groups =
      groupIds.length === 0
        ? []
        : await this.database.attributeGroup.findMany({
            where: { id: { in: groupIds } },
            select: { id: true, code: true },
          });
    const groupCodeById = new Map(groups.map((group) => [group.id, group.code]));

    return {
      filename: 'lemekinaye-attributes.csv',
      csv: stringifyCsv([
        ATTRIBUTE_CSV_HEADERS,
        ...attributes.map((attribute) => [
          attribute.code,
          attribute.name,
          attribute.groupId ? (groupCodeById.get(attribute.groupId) ?? '') : '',
          attribute.dataType,
          attribute.scope,
          attribute.valueSource,
          attribute.unit ?? '',
          attribute.description ?? '',
          attribute.exampleValue ?? '',
          attribute.repeatable,
          attribute.translatable,
          attribute.status,
        ]),
      ]),
    };
  }

  async previewAttributeCsvImport(
    request: AttributeCsvImportRequestDto,
  ): Promise<AttributeCsvImportPreviewResponseDto> {
    const prepared = await this.prepareAttributeCsvImport(request.csv);
    return this.importPreview(prepared);
  }

  async commitAttributeCsvImport(
    request: AttributeCsvImportRequestDto,
    actorId: string,
  ): Promise<AttributeCsvImportCommitResponseDto> {
    const prepared = await this.prepareAttributeCsvImport(request.csv);
    const preview = this.importPreview(prepared);
    if (preview.invalidRows > 0 || preview.totalRows === 0) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_IMPORT_INVALID',
        message:
          preview.totalRows === 0
            ? 'The CSV does not contain any Attribute rows'
            : 'Fix all Attribute import errors before committing',
        preview,
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const createdCodes: string[] = [];
          for (const row of prepared) {
            const created = await this.createAttributeRecord(
              transaction,
              row.input,
              actorId,
            );
            createdCodes.push(created.code);
          }
          await transaction.adminImportJob.create({
            data: {
              workflow: 'ATTRIBUTE_LIBRARY',
              fileName: request.fileName?.trim() || null,
              fileFormat: 'CSV',
              status: 'COMPLETED',
              totalRows: preview.totalRows,
              includedRows: preview.totalRows,
              excludedRows: 0,
              warningRows: 0,
              createdCount: createdCodes.length,
              metadata: { createdCodes },
              createdById: actorId,
            },
          });

          return {
            createdCount: createdCodes.length,
            createdCodes,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAttributePersistenceError(error);
    }
  }

  async getAdminAttributeSummary(): Promise<AttributeDefinitionSummaryResponseDto> {
    const grouped = await this.database.attributeDefinition.groupBy({
      by: ['groupId'],
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

  async getAdminAttribute(id: string): Promise<AttributeDefinitionResponseDto> {
    const attribute = await this.database.attributeDefinition.findUnique({
      where: { id },
      select: attributeSelect,
    });
    if (!attribute) throw this.attributeNotFound();
    return attribute;
  }

  async createAttribute(
    input: CreateAttributeDefinitionDto,
    actorId: string,
  ): Promise<AttributeDefinitionResponseDto> {
    const nonTechnicalReason = nonTechnicalAttributeReason(input.code, input.name);
    if (nonTechnicalReason) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_NON_TECHNICAL_DOMAIN_RESERVED',
        message: nonTechnicalReason,
      });
    }

    try {
      return await this.database.$transaction(
        (transaction) => this.createAttributeRecord(transaction, input, actorId),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAttributePersistenceError(error);
    }
  }

  async updateAttribute(
    id: string,
    input: UpdateAttributeDefinitionDto,
    actorId: string,
  ): Promise<AttributeDefinitionResponseDto> {
    if (!this.hasAttributeChanges(input)) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_UPDATE_EMPTY',
        message: 'At least one attribute field must be supplied',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current = await transaction.attributeDefinition.findUnique({
            where: { id },
          });
          if (!current) throw this.attributeNotFound();
          if (current.version !== input.version) {
            throw this.attributeVersionConflict();
          }

          assertMasterRecordEditable(current.status);
          assertDirectMasterStatusChange(current.status, input.status);

          const nonTechnicalReason = nonTechnicalAttributeReason(
            current.code,
            input.name ?? current.name,
          );
          if (nonTechnicalReason) {
            throw new BadRequestException({
              code: 'ATTRIBUTE_NON_TECHNICAL_DOMAIN_RESERVED',
              message: nonTechnicalReason,
            });
          }

          const nextStatus = input.status ?? current.status;
          const nextGroupId =
            input.groupId === undefined ? current.groupId : input.groupId;
          await this.assertAttributeGroup(
            transaction,
            nextGroupId,
            nextStatus,
          );

          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const activeValue = await transaction.attributeAllowedValue.findFirst({
              where: {
                attributeId: id,
                status: MasterDataStatus.ACTIVE,
              },
              select: { id: true },
            });
            if (activeValue) {
              throw new ConflictException({
                code: 'ATTRIBUTE_HAS_ACTIVE_VALUES',
                message: 'Deactivate active attribute values first',
              });
            }

            const activeAssignment =
              await transaction.productTypeAttributeAssignment.findFirst({
                where: {
                  attributeId: id,
                  status: MasterDataStatus.ACTIVE,
                },
                select: { id: true },
              });
            if (activeAssignment) {
              throw new ConflictException({
                code: 'ATTRIBUTE_HAS_ACTIVE_ASSIGNMENTS',
                message: 'Deactivate active Product Type assignments first',
              });
            }

            const activeAlias = await transaction.attributeAlias.findFirst({
              where: {
                attributeId: id,
                status: MasterDataStatus.ACTIVE,
              },
              select: { id: true },
            });
            if (activeAlias) {
              throw new ConflictException({
                code: 'ATTRIBUTE_HAS_ACTIVE_ALIASES',
                message: 'Deactivate active Attribute Aliases first',
              });
            }
          }

          const attribute = await transaction.attributeDefinition.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              groupId: input.groupId,
              unit:
                input.unit === undefined
                  ? undefined
                  : this.normalizeOptionalText(input.unit),
              description:
                input.description === undefined
                  ? undefined
                  : this.normalizeOptionalText(input.description),
              exampleValue:
                input.exampleValue === undefined
                  ? undefined
                  : this.normalizeOptionalText(input.exampleValue),
              repeatable: input.repeatable,
              translatable: input.translatable,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ATTRIBUTE_DEFINITION_UPDATED',
              entityType: 'AttributeDefinition',
              entityId: attribute.id,
              metadata: {
                before: this.attributeSnapshot(current),
                after: this.attributeSnapshot(attribute),
              },
            },
          });

          return this.toAttributeResponse(attribute);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAttributePersistenceError(error);
    }
  }

  async listAdminAllowedValues(
    attributeId: string,
    query: AttributeAllowedValueAdminQueryDto,
  ): Promise<AttributeAllowedValueResponseDto[]> {
    const attribute = await this.database.attributeDefinition.findUnique({
      where: { id: attributeId },
      select: { id: true },
    });
    if (!attribute) throw this.attributeNotFound();

    return this.database.attributeAllowedValue.findMany({
      where: { attributeId, status: query.status },
      select: allowedValueSelect,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async createAllowedValue(
    attributeId: string,
    input: CreateAttributeAllowedValueDto,
    actorId: string,
  ): Promise<AttributeAllowedValueResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const attribute = await transaction.attributeDefinition.findUnique({
            where: { id: attributeId },
          });
          if (!attribute) throw this.attributeNotFound();
          this.assertStaticAttribute(attribute);

          const status = input.status ?? MasterDataStatus.DRAFT;
          if (
            status === MasterDataStatus.ACTIVE &&
            attribute.status !== MasterDataStatus.ACTIVE
          ) {
            throw new ConflictException({
              code: 'ATTRIBUTE_NOT_ACTIVE',
              message: 'An active allowed value requires an active attribute',
            });
          }

          const value = await transaction.attributeAllowedValue.create({
            data: {
              attributeId,
              code: input.code,
              label: input.label.trim(),
              description: this.normalizeOptionalText(input.description),
              sortOrder: input.sortOrder ?? 0,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ATTRIBUTE_ALLOWED_VALUE_CREATED',
              entityType: 'AttributeAllowedValue',
              entityId: value.id,
              metadata: { after: this.allowedValueSnapshot(value) },
            },
          });

          return this.toAllowedValueResponse(value);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAllowedValuePersistenceError(error);
    }
  }

  async updateAllowedValue(
    attributeId: string,
    valueId: string,
    input: UpdateAttributeAllowedValueDto,
    actorId: string,
  ): Promise<AttributeAllowedValueResponseDto> {
    if (!this.hasAllowedValueChanges(input)) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_VALUE_UPDATE_EMPTY',
        message: 'At least one allowed-value field must be supplied',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const attribute = await transaction.attributeDefinition.findUnique({
            where: { id: attributeId },
          });
          if (!attribute) throw this.attributeNotFound();
          this.assertStaticAttribute(attribute);

          const current = await transaction.attributeAllowedValue.findFirst({
            where: { id: valueId, attributeId },
          });
          if (!current) throw this.allowedValueNotFound();
          if (current.version !== input.version) {
            throw this.allowedValueVersionConflict();
          }

          const nextStatus = input.status ?? current.status;
          if (
            nextStatus === MasterDataStatus.ACTIVE &&
            attribute.status !== MasterDataStatus.ACTIVE
          ) {
            throw new ConflictException({
              code: 'ATTRIBUTE_NOT_ACTIVE',
              message: 'An active allowed value requires an active attribute',
            });
          }

          const value = await transaction.attributeAllowedValue.update({
            where: { id: valueId, version: input.version },
            data: {
              label: input.label?.trim(),
              description:
                input.description === undefined
                  ? undefined
                  : this.normalizeOptionalText(input.description),
              sortOrder: input.sortOrder,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ATTRIBUTE_ALLOWED_VALUE_UPDATED',
              entityType: 'AttributeAllowedValue',
              entityId: value.id,
              metadata: {
                before: this.allowedValueSnapshot(current),
                after: this.allowedValueSnapshot(value),
              },
            },
          });

          return this.toAllowedValueResponse(value);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAllowedValuePersistenceError(error);
    }
  }

  private attributeWhere(
    query: AttributeAdminPageQueryDto | AttributeCsvExportQueryDto,
  ): Prisma.AttributeDefinitionWhereInput {
    const search = query.search?.trim();
    return {
      groupId: query.ungrouped ? null : query.groupId,
      status: query.status,
      dataType: query.dataType,
      scope: query.scope,
      valueSource: query.valueSource,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { exampleValue: { contains: search, mode: 'insensitive' } },
              { unit: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private attributeOrderBy(
    sortBy: AttributeAdminSortBy | undefined,
    sortDirection: AdminSortDirection | undefined,
  ): Prisma.AttributeDefinitionOrderByWithRelationInput[] {
    const direction =
      sortDirection === AdminSortDirection.DESC ? 'desc' : 'asc';
    return sortBy === AttributeAdminSortBy.CREATED_AT
      ? [{ createdAt: direction }, { id: 'asc' }]
      : sortBy === AttributeAdminSortBy.UPDATED_AT
        ? [{ updatedAt: direction }, { id: 'asc' }]
        : sortBy === AttributeAdminSortBy.CODE
          ? [{ code: direction }, { id: 'asc' }]
          : sortBy === AttributeAdminSortBy.DATA_TYPE
            ? [
                { dataType: direction },
                { name: 'asc' },
                { code: 'asc' },
                { id: 'asc' },
              ]
            : sortBy === AttributeAdminSortBy.SCOPE
              ? [
                  { scope: direction },
                  { name: 'asc' },
                  { code: 'asc' },
                  { id: 'asc' },
                ]
              : sortBy === AttributeAdminSortBy.VALUE_SOURCE
                ? [
                    { valueSource: direction },
                    { name: 'asc' },
                    { code: 'asc' },
                    { id: 'asc' },
                  ]
                : sortBy === AttributeAdminSortBy.STATUS
                  ? [
                      { status: direction },
                      { name: 'asc' },
                      { code: 'asc' },
                      { id: 'asc' },
                    ]
                  : [
                      { name: direction },
                      { code: 'asc' },
                      { id: 'asc' },
                    ];
  }

  private async prepareAttributeCsvImport(
    csv: string,
  ): Promise<PreparedAttributeImportRow[]> {
    let parsed: string[][];
    try {
      parsed = parseCsv(csv);
    } catch (error) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_IMPORT_CSV_INVALID',
        message:
          error instanceof Error ? error.message : 'The CSV could not be parsed',
      });
    }

    const nonEmptyRows = parsed.filter((row) =>
      row.some((cell) => cell.trim().length > 0),
    );
    if (nonEmptyRows.length === 0) return [];

    const headers = nonEmptyRows[0].map((header) => header.trim().toLowerCase());
    const supported = new Set(ATTRIBUTE_CSV_HEADERS.map((header) => header.toLowerCase()));
    const duplicateHeaders = headers.filter(
      (header, index) => headers.indexOf(header) !== index,
    );
    const unsupportedHeaders = headers.filter((header) => !supported.has(header));
    const missingHeaders = ATTRIBUTE_CSV_REQUIRED_HEADERS.filter(
      (header) => !headers.includes(header.toLowerCase()),
    );
    if (
      duplicateHeaders.length > 0 ||
      unsupportedHeaders.length > 0 ||
      missingHeaders.length > 0
    ) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_IMPORT_HEADERS_INVALID',
        message: 'The Attribute CSV headers are invalid',
        duplicateHeaders: [...new Set(duplicateHeaders)],
        unsupportedHeaders: [...new Set(unsupportedHeaders)],
        missingHeaders,
      });
    }

    const dataRows = nonEmptyRows.slice(1);
    if (dataRows.length > MAX_ATTRIBUTE_IMPORT_ROWS) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_IMPORT_TOO_LARGE',
        message: `Attribute CSV import supports at most ${MAX_ATTRIBUTE_IMPORT_ROWS} rows per batch`,
      });
    }

    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const cell = (row: string[], header: string): string => {
      const index = headerIndex.get(header.toLowerCase());
      return index === undefined ? '' : (row[index] ?? '').trim();
    };

    const rawRows = dataRows.map((row, index) => ({
      row,
      rowNumber: index + 2,
      code: cell(row, 'code').toUpperCase(),
      name: cell(row, 'name'),
      groupCode: cell(row, 'groupCode').toUpperCase() || null,
      dataType: cell(row, 'dataType').toUpperCase(),
      scope: cell(row, 'scope').toUpperCase(),
      valueSource: cell(row, 'valueSource').toUpperCase() || AttributeValueSource.NONE,
      unit: cell(row, 'unit') || null,
      description: cell(row, 'description') || null,
      exampleValue: cell(row, 'exampleValue') || null,
      repeatableText: cell(row, 'repeatable'),
      translatableText: cell(row, 'translatable'),
      status: cell(row, 'status').toUpperCase() || MasterDataStatus.DRAFT,
    }));

    const groupCodes = [
      ...new Set(
        rawRows
          .map((row) => row.groupCode)
          .filter((groupCode): groupCode is string => Boolean(groupCode)),
      ),
    ];
    const codes = [...new Set(rawRows.map((row) => row.code).filter(Boolean))];

    const [groups, existingAttributes] = await Promise.all([
      groupCodes.length === 0
        ? Promise.resolve([])
        : this.database.attributeGroup.findMany({
            where: { code: { in: groupCodes } },
            select: { id: true, code: true, status: true },
          }),
      codes.length === 0
        ? Promise.resolve([])
        : this.database.attributeDefinition.findMany({
            where: { code: { in: codes } },
            select: { code: true },
          }),
    ]);
    const groupByCode = new Map(groups.map((group) => [group.code, group]));
    const existingCodes = new Set(
      existingAttributes.map((attribute) => attribute.code),
    );
    const fileCodeCounts = rawRows.reduce<Map<string, number>>((counts, row) => {
      if (row.code) counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
      return counts;
    }, new Map());

    return rawRows.map((row) => {
      const errors: string[] = [];
      if (row.row.length > headers.length) {
        errors.push('Row contains more columns than the CSV header');
      }

      const repeatable = this.parseCsvBoolean(
        row.repeatableText,
        'repeatable',
        errors,
      );
      const translatable = this.parseCsvBoolean(
        row.translatableText,
        'translatable',
        errors,
      );
      const group = row.groupCode ? groupByCode.get(row.groupCode) : undefined;
      if (row.groupCode && !group) {
        errors.push(`Attribute Group ${row.groupCode} was not found`);
      }
      if ((fileCodeCounts.get(row.code) ?? 0) > 1) {
        errors.push('Attribute code is duplicated within this CSV');
      }
      if (row.code && existingCodes.has(row.code)) {
        errors.push('Attribute code already exists');
      }

      const input = Object.assign(new CreateAttributeDefinitionDto(), {
        code: row.code,
        name: row.name,
        groupId: group?.id ?? null,
        dataType: row.dataType as AttributeDataType,
        scope: row.scope as AttributeScope,
        valueSource: row.valueSource as AttributeValueSource,
        unit: row.unit,
        description: row.description,
        exampleValue: row.exampleValue,
        repeatable,
        translatable,
        status: row.status as MasterDataStatus,
      });
      errors.push(...this.attributeDtoErrors(input));

      const nonTechnicalReason = nonTechnicalAttributeReason(
        input.code,
        input.name,
      );
      if (nonTechnicalReason) {
        errors.push(nonTechnicalReason);
      }

      if (
        group &&
        input.status === MasterDataStatus.ACTIVE &&
        group.status !== MasterDataStatus.ACTIVE
      ) {
        errors.push('An Active Attribute requires an Active Attribute Group');
      }

      return {
        preview: {
          rowNumber: row.rowNumber,
          code: row.code,
          name: row.name,
          groupCode: row.groupCode,
          dataType: row.dataType,
          scope: row.scope,
          status: row.status,
          errors: [...new Set(errors)],
        },
        input,
      };
    });
  }

  private importPreview(
    prepared: PreparedAttributeImportRow[],
  ): AttributeCsvImportPreviewResponseDto {
    const rows = prepared.map((row) => row.preview);
    const invalidRows = rows.filter((row) => row.errors.length > 0).length;
    return {
      totalRows: rows.length,
      validRows: rows.length - invalidRows,
      invalidRows,
      rows,
    };
  }

  private parseCsvBoolean(
    value: string,
    field: string,
    errors: string[],
  ): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    errors.push(`${field} must be true/false, yes/no, or 1/0`);
    return false;
  }

  private attributeDtoErrors(input: CreateAttributeDefinitionDto): string[] {
    return validateSync(input).flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
  }

  private async createAttributeRecord(
    transaction: Prisma.TransactionClient,
    input: CreateAttributeDefinitionDto,
    actorId: string,
  ): Promise<AttributeDefinitionResponseDto> {
    const nonTechnicalReason = nonTechnicalAttributeReason(input.code, input.name);
    if (nonTechnicalReason) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_NON_TECHNICAL_DOMAIN_RESERVED',
        message: nonTechnicalReason,
      });
    }

    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);
    await this.assertAttributeGroup(
      transaction,
      input.groupId ?? null,
      status,
    );

    const attribute = await transaction.attributeDefinition.create({
      data: {
        code: input.code,
        name: input.name.trim(),
        groupId: input.groupId ?? null,
        dataType: input.dataType,
        scope: input.scope,
        valueSource: input.valueSource ?? AttributeValueSource.NONE,
        unit: this.normalizeOptionalText(input.unit),
        description: this.normalizeOptionalText(input.description),
        exampleValue: this.normalizeOptionalText(input.exampleValue),
        repeatable: input.repeatable ?? false,
        translatable: input.translatable ?? false,
        status,
        createdById: actorId,
        updatedById: actorId,
      },
    });

    await transaction.auditLog.create({
      data: {
        actorId,
        action: 'ATTRIBUTE_DEFINITION_CREATED',
        entityType: 'AttributeDefinition',
        entityId: attribute.id,
        metadata: { after: this.attributeSnapshot(attribute) },
      },
    });

    return this.toAttributeResponse(attribute);
  }

  private async assertAttributeGroup(
    transaction: Prisma.TransactionClient,
    groupId: string | null,
    status: MasterDataStatus,
  ): Promise<void> {
    if (!groupId) return;

    const group = await transaction.attributeGroup.findUnique({
      where: { id: groupId },
      select: { id: true, status: true },
    });
    if (!group) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_GROUP_NOT_FOUND',
        message: 'The selected Attribute Group does not exist',
      });
    }
    if (
      status === MasterDataStatus.ACTIVE &&
      group.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'ATTRIBUTE_GROUP_NOT_ACTIVE',
        message: 'An Active Attribute requires an Active Attribute Group',
      });
    }
  }

  private assertStaticAttribute(attribute: AttributeDefinition): void {
    if (attribute.valueSource !== AttributeValueSource.STATIC) {
      throw new ConflictException({
        code: 'ATTRIBUTE_VALUES_NOT_STATIC',
        message: 'Allowed values can be managed only for STATIC attributes',
      });
    }
  }

  private hasAttributeChanges(input: UpdateAttributeDefinitionDto): boolean {
    return (
      input.name !== undefined ||
      input.groupId !== undefined ||
      input.unit !== undefined ||
      input.description !== undefined ||
      input.exampleValue !== undefined ||
      input.repeatable !== undefined ||
      input.translatable !== undefined ||
      input.status !== undefined
    );
  }

  private hasAllowedValueChanges(
    input: UpdateAttributeAllowedValueDto,
  ): boolean {
    return (
      input.label !== undefined ||
      input.description !== undefined ||
      input.sortOrder !== undefined ||
      input.status !== undefined
    );
  }

  private normalizeOptionalText(
    value: string | null | undefined,
  ): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private attributeSnapshot(
    attribute: AttributeDefinition,
  ): Prisma.InputJsonObject {
    return {
      id: attribute.id,
      code: attribute.code,
      name: attribute.name,
      dataType: attribute.dataType,
      scope: attribute.scope,
      groupId: attribute.groupId,
      valueSource: attribute.valueSource,
      unit: attribute.unit,
      description: attribute.description,
      exampleValue: attribute.exampleValue,
      repeatable: attribute.repeatable,
      translatable: attribute.translatable,
      status: attribute.status,
      version: attribute.version,
    };
  }

  private allowedValueSnapshot(
    value: AttributeAllowedValue,
  ): Prisma.InputJsonObject {
    return {
      id: value.id,
      attributeId: value.attributeId,
      code: value.code,
      label: value.label,
      description: value.description,
      sortOrder: value.sortOrder,
      status: value.status,
      version: value.version,
    };
  }

  private toAttributeResponse(
    attribute: AttributeDefinition,
  ): AttributeDefinitionResponseDto {
    return {
      id: attribute.id,
      groupId: attribute.groupId,
      optionSetId: attribute.optionSetId,
      unitDimensionId: attribute.unitDimensionId,
      defaultUnitId: attribute.defaultUnitId,
      code: attribute.code,
      name: attribute.name,
      dataType: attribute.dataType,
      scope: attribute.scope,
      valueSource: attribute.valueSource,
      unit: attribute.unit,
      description: attribute.description,
      exampleValue: attribute.exampleValue,
      validationRule: attribute.validationRule,
      repeatable: attribute.repeatable,
      translatable: attribute.translatable,
      status: attribute.status,
      version: attribute.version,
      createdAt: attribute.createdAt,
      updatedAt: attribute.updatedAt,
    };
  }

  private toAllowedValueResponse(
    value: AttributeAllowedValue,
  ): AttributeAllowedValueResponseDto {
    return {
      id: value.id,
      attributeId: value.attributeId,
      code: value.code,
      label: value.label,
      description: value.description,
      sortOrder: value.sortOrder,
      status: value.status,
      version: value.version,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  private attributeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ATTRIBUTE_NOT_FOUND',
      message: 'Attribute definition was not found',
    });
  }

  private allowedValueNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ATTRIBUTE_VALUE_NOT_FOUND',
      message: 'Attribute allowed value was not found',
    });
  }

  private attributeVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'ATTRIBUTE_VERSION_CONFLICT',
      message: 'The attribute changed; reload it before trying again',
    });
  }

  private allowedValueVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'ATTRIBUTE_VALUE_VERSION_CONFLICT',
      message: 'The allowed value changed; reload it before trying again',
    });
  }

  private rethrowAttributePersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'ATTRIBUTE_ALREADY_EXISTS',
        message: 'Attribute code must be unique',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.attributeVersionConflict();
    }
    throw error;
  }

  private rethrowAllowedValuePersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'ATTRIBUTE_VALUE_ALREADY_EXISTS',
        message: 'Allowed value code must be unique for the attribute',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.allowedValueVersionConflict();
    }
    throw error;
  }
}
