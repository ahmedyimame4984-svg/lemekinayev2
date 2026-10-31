import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  type AttributeAlias,
  type AttributeGroup,
  type AttributeOptionSet,
  type AttributeOptionValue,
  type AttributeUnit,
  type UnitDimension,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { nonTechnicalAttributeGroupReason } from './catalog-attribute-policy.js';
import type {
  AttributeAliasResponseDto,
  AttributeGroupResponseDto,
  AttributeOptionSetResponseDto,
  AttributeOptionValueResponseDto,
  AttributeUnitResponseDto,
  CreateAttributeAliasDto,
  CreateAttributeGroupDto,
  CreateAttributeOptionSetDto,
  CreateAttributeOptionValueDto,
  CreateAttributeUnitDto,
  CreateUnitDimensionDto,
  MasterStatusQueryDto,
  UnitDimensionResponseDto,
  UpdateAttributeAliasDto,
  UpdateAttributeGroupDto,
  UpdateAttributeOptionSetDto,
  UpdateAttributeOptionValueDto,
  UpdateAttributeUnitDto,
  UpdateUnitDimensionDto,
} from './dto/attribute-master-v2.dto.js';

const groupSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  sortOrder: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeGroupSelect;

const optionSetSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeOptionSetSelect;

const optionValueSelect = {
  id: true,
  optionSetId: true,
  code: true,
  label: true,
  description: true,
  sortOrder: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeOptionValueSelect;

const dimensionSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UnitDimensionSelect;

const unitSelect = {
  id: true,
  dimensionId: true,
  code: true,
  name: true,
  symbol: true,
  isBase: true,
  factorToBase: true,
  offsetToBase: true,
  sortOrder: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeUnitSelect;

type AttributeUnitView = Prisma.AttributeUnitGetPayload<{
  select: typeof unitSelect;
}>;

const aliasSelect = {
  id: true,
  attributeId: true,
  alias: true,
  normalizedAlias: true,
  locale: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeAliasSelect;

@Injectable()
export class CatalogAttributeMasterV2Service {
  constructor(private readonly database: DatabaseService) {}

  listGroups(query: MasterStatusQueryDto): Promise<AttributeGroupResponseDto[]> {
    return this.database.attributeGroup.findMany({
      where: { status: query.status },
      select: groupSelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createGroup(
    input: CreateAttributeGroupDto,
    actorId: string,
  ): Promise<AttributeGroupResponseDto> {
    const nonTechnicalGroupReason = nonTechnicalAttributeGroupReason(
      input.code,
      input.name,
    );
    if (nonTechnicalGroupReason) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_GROUP_NON_TECHNICAL_DOMAIN_RESERVED',
        message: nonTechnicalGroupReason,
      });
    }

    try {
      return await this.database.$transaction(
        async (tx) => {
          const record = await tx.attributeGroup.create({
            data: {
              code: input.code,
              name: input.name.trim(),
              description: this.optionalText(input.description),
              sortOrder: input.sortOrder ?? 0,
              status: input.status ?? MasterDataStatus.DRAFT,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_GROUP_CREATED', 'AttributeGroup', record.id, {
            after: this.groupSnapshot(record),
          });
          return this.toGroup(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_GROUP_ALREADY_EXISTS', 'Attribute Group code must be unique', 'ATTRIBUTE_GROUP_VERSION_CONFLICT');
    }
  }

  async updateGroup(
    id: string,
    input: UpdateAttributeGroupDto,
    actorId: string,
  ): Promise<AttributeGroupResponseDto> {
    this.assertChanges(input, ['name', 'description', 'sortOrder', 'status'], 'ATTRIBUTE_GROUP_UPDATE_EMPTY');
    try {
      return await this.database.$transaction(
        async (tx) => {
          const current = await tx.attributeGroup.findUnique({ where: { id } });
          if (!current) throw this.notFound('ATTRIBUTE_GROUP_NOT_FOUND', 'Attribute Group was not found');
          this.assertVersion(current.version, input.version, 'ATTRIBUTE_GROUP_VERSION_CONFLICT');

          const nonTechnicalGroupReason = nonTechnicalAttributeGroupReason(
            current.code,
            input.name ?? current.name,
          );
          if (nonTechnicalGroupReason) {
            throw new BadRequestException({
              code: 'ATTRIBUTE_GROUP_NON_TECHNICAL_DOMAIN_RESERVED',
              message: nonTechnicalGroupReason,
            });
          }

          if (
            current.status === MasterDataStatus.ACTIVE &&
            input.status !== undefined &&
            input.status !== MasterDataStatus.ACTIVE
          ) {
            const activeAttribute = await tx.attributeDefinition.findFirst({
              where: { groupId: id, status: MasterDataStatus.ACTIVE },
              select: { id: true },
            });
            if (activeAttribute) {
              throw new ConflictException({
                code: 'ATTRIBUTE_GROUP_IN_USE',
                message: 'Deactivate active attributes in this group first',
              });
            }
          }

          const record = await tx.attributeGroup.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              description:
                input.description === undefined
                  ? undefined
                  : this.optionalText(input.description),
              sortOrder: input.sortOrder,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_GROUP_UPDATED', 'AttributeGroup', record.id, {
            before: this.groupSnapshot(current),
            after: this.groupSnapshot(record),
          });
          return this.toGroup(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_GROUP_ALREADY_EXISTS', 'Attribute Group code must be unique', 'ATTRIBUTE_GROUP_VERSION_CONFLICT');
    }
  }

  listOptionSets(query: MasterStatusQueryDto): Promise<AttributeOptionSetResponseDto[]> {
    return this.database.attributeOptionSet.findMany({
      where: { status: query.status },
      select: optionSetSelect,
      orderBy: [{ name: 'asc' }],
    });
  }

  async createOptionSet(
    input: CreateAttributeOptionSetDto,
    actorId: string,
  ): Promise<AttributeOptionSetResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const record = await tx.attributeOptionSet.create({
            data: {
              code: input.code,
              name: input.name.trim(),
              description: this.optionalText(input.description),
              status: input.status ?? MasterDataStatus.DRAFT,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_OPTION_SET_CREATED', 'AttributeOptionSet', record.id, {
            after: this.optionSetSnapshot(record),
          });
          return this.toOptionSet(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_OPTION_SET_ALREADY_EXISTS', 'Option Set code must be unique', 'ATTRIBUTE_OPTION_SET_VERSION_CONFLICT');
    }
  }

  async updateOptionSet(
    id: string,
    input: UpdateAttributeOptionSetDto,
    actorId: string,
  ): Promise<AttributeOptionSetResponseDto> {
    this.assertChanges(input, ['name', 'description', 'status'], 'ATTRIBUTE_OPTION_SET_UPDATE_EMPTY');
    try {
      return await this.database.$transaction(
        async (tx) => {
          const current = await tx.attributeOptionSet.findUnique({ where: { id } });
          if (!current) throw this.notFound('ATTRIBUTE_OPTION_SET_NOT_FOUND', 'Option Set was not found');
          this.assertVersion(current.version, input.version, 'ATTRIBUTE_OPTION_SET_VERSION_CONFLICT');

          if (
            current.status === MasterDataStatus.ACTIVE &&
            input.status !== undefined &&
            input.status !== MasterDataStatus.ACTIVE
          ) {
            const [activeValue, activeAttribute] = await Promise.all([
              tx.attributeOptionValue.findFirst({
                where: { optionSetId: id, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
              tx.attributeDefinition.findFirst({
                where: { optionSetId: id, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
            ]);
            if (activeValue || activeAttribute) {
              throw new ConflictException({
                code: 'ATTRIBUTE_OPTION_SET_IN_USE',
                message: 'Deactivate active option values and attributes using this Option Set first',
              });
            }
          }

          const record = await tx.attributeOptionSet.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              description:
                input.description === undefined
                  ? undefined
                  : this.optionalText(input.description),
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_OPTION_SET_UPDATED', 'AttributeOptionSet', record.id, {
            before: this.optionSetSnapshot(current),
            after: this.optionSetSnapshot(record),
          });
          return this.toOptionSet(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_OPTION_SET_ALREADY_EXISTS', 'Option Set code must be unique', 'ATTRIBUTE_OPTION_SET_VERSION_CONFLICT');
    }
  }

  async listOptionValues(
    optionSetId: string,
    query: MasterStatusQueryDto,
  ): Promise<AttributeOptionValueResponseDto[]> {
    await this.requireOptionSet(optionSetId);
    return this.database.attributeOptionValue.findMany({
      where: { optionSetId, status: query.status },
      select: optionValueSelect,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async createOptionValue(
    optionSetId: string,
    input: CreateAttributeOptionValueDto,
    actorId: string,
  ): Promise<AttributeOptionValueResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const parent = await tx.attributeOptionSet.findUnique({ where: { id: optionSetId } });
          if (!parent) throw this.notFound('ATTRIBUTE_OPTION_SET_NOT_FOUND', 'Option Set was not found');
          const status = input.status ?? MasterDataStatus.DRAFT;
          this.assertActiveParent(status, parent.status, 'ATTRIBUTE_OPTION_SET_NOT_ACTIVE', 'An active Option Value requires an active Option Set');

          const record = await tx.attributeOptionValue.create({
            data: {
              optionSetId,
              code: input.code,
              label: input.label.trim(),
              description: this.optionalText(input.description),
              sortOrder: input.sortOrder ?? 0,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_OPTION_VALUE_CREATED', 'AttributeOptionValue', record.id, {
            after: this.optionValueSnapshot(record),
          });
          return this.toOptionValue(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_OPTION_VALUE_ALREADY_EXISTS', 'Option Value code must be unique within the Option Set', 'ATTRIBUTE_OPTION_VALUE_VERSION_CONFLICT');
    }
  }

  async updateOptionValue(
    optionSetId: string,
    valueId: string,
    input: UpdateAttributeOptionValueDto,
    actorId: string,
  ): Promise<AttributeOptionValueResponseDto> {
    this.assertChanges(input, ['label', 'description', 'sortOrder', 'status'], 'ATTRIBUTE_OPTION_VALUE_UPDATE_EMPTY');
    try {
      return await this.database.$transaction(
        async (tx) => {
          const [parent, current] = await Promise.all([
            tx.attributeOptionSet.findUnique({ where: { id: optionSetId } }),
            tx.attributeOptionValue.findFirst({ where: { id: valueId, optionSetId } }),
          ]);
          if (!parent) throw this.notFound('ATTRIBUTE_OPTION_SET_NOT_FOUND', 'Option Set was not found');
          if (!current) throw this.notFound('ATTRIBUTE_OPTION_VALUE_NOT_FOUND', 'Option Value was not found');
          this.assertVersion(current.version, input.version, 'ATTRIBUTE_OPTION_VALUE_VERSION_CONFLICT');
          this.assertActiveParent(
            input.status ?? current.status,
            parent.status,
            'ATTRIBUTE_OPTION_SET_NOT_ACTIVE',
            'An active Option Value requires an active Option Set',
          );

          const record = await tx.attributeOptionValue.update({
            where: { id: valueId, version: input.version },
            data: {
              label: input.label?.trim(),
              description:
                input.description === undefined
                  ? undefined
                  : this.optionalText(input.description),
              sortOrder: input.sortOrder,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_OPTION_VALUE_UPDATED', 'AttributeOptionValue', record.id, {
            before: this.optionValueSnapshot(current),
            after: this.optionValueSnapshot(record),
          });
          return this.toOptionValue(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_OPTION_VALUE_ALREADY_EXISTS', 'Option Value code must be unique within the Option Set', 'ATTRIBUTE_OPTION_VALUE_VERSION_CONFLICT');
    }
  }

  listDimensions(query: MasterStatusQueryDto): Promise<UnitDimensionResponseDto[]> {
    return this.database.unitDimension.findMany({
      where: { status: query.status },
      select: dimensionSelect,
      orderBy: [{ name: 'asc' }],
    });
  }

  async createDimension(
    input: CreateUnitDimensionDto,
    actorId: string,
  ): Promise<UnitDimensionResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const record = await tx.unitDimension.create({
            data: {
              code: input.code,
              name: input.name.trim(),
              description: this.optionalText(input.description),
              status: input.status ?? MasterDataStatus.DRAFT,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'UNIT_DIMENSION_CREATED', 'UnitDimension', record.id, {
            after: this.dimensionSnapshot(record),
          });
          return this.toDimension(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'UNIT_DIMENSION_ALREADY_EXISTS', 'Unit Dimension code must be unique', 'UNIT_DIMENSION_VERSION_CONFLICT');
    }
  }

  async updateDimension(
    id: string,
    input: UpdateUnitDimensionDto,
    actorId: string,
  ): Promise<UnitDimensionResponseDto> {
    this.assertChanges(input, ['name', 'description', 'status'], 'UNIT_DIMENSION_UPDATE_EMPTY');
    try {
      return await this.database.$transaction(
        async (tx) => {
          const current = await tx.unitDimension.findUnique({ where: { id } });
          if (!current) throw this.notFound('UNIT_DIMENSION_NOT_FOUND', 'Unit Dimension was not found');
          this.assertVersion(current.version, input.version, 'UNIT_DIMENSION_VERSION_CONFLICT');

          if (
            current.status === MasterDataStatus.ACTIVE &&
            input.status !== undefined &&
            input.status !== MasterDataStatus.ACTIVE
          ) {
            const [activeUnit, activeAttribute] = await Promise.all([
              tx.attributeUnit.findFirst({
                where: { dimensionId: id, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
              tx.attributeDefinition.findFirst({
                where: { unitDimensionId: id, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
            ]);
            if (activeUnit || activeAttribute) {
              throw new ConflictException({
                code: 'UNIT_DIMENSION_IN_USE',
                message: 'Deactivate active units and attributes using this dimension first',
              });
            }
          }

          const record = await tx.unitDimension.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              description:
                input.description === undefined
                  ? undefined
                  : this.optionalText(input.description),
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'UNIT_DIMENSION_UPDATED', 'UnitDimension', record.id, {
            before: this.dimensionSnapshot(current),
            after: this.dimensionSnapshot(record),
          });
          return this.toDimension(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'UNIT_DIMENSION_ALREADY_EXISTS', 'Unit Dimension code must be unique', 'UNIT_DIMENSION_VERSION_CONFLICT');
    }
  }

  async listUnits(
    dimensionId: string,
    query: MasterStatusQueryDto,
  ): Promise<AttributeUnitResponseDto[]> {
    await this.requireDimension(dimensionId);
    const records = await this.database.attributeUnit.findMany({
      where: { dimensionId, status: query.status },
      select: unitSelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return records.map((record) => this.toUnit(record));
  }

  async createUnit(
    dimensionId: string,
    input: CreateAttributeUnitDto,
    actorId: string,
  ): Promise<AttributeUnitResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const dimension = await tx.unitDimension.findUnique({ where: { id: dimensionId } });
          if (!dimension) throw this.notFound('UNIT_DIMENSION_NOT_FOUND', 'Unit Dimension was not found');
          const status = input.status ?? MasterDataStatus.DRAFT;
          this.assertActiveParent(status, dimension.status, 'UNIT_DIMENSION_NOT_ACTIVE', 'An active Unit requires an active Unit Dimension');
          this.assertBaseConversion(input.isBase ?? false, input.factorToBase ?? '1', input.offsetToBase ?? '0');

          if (input.isBase) {
            const existingBase = await tx.attributeUnit.findFirst({
              where: { dimensionId, isBase: true },
              select: { id: true },
            });
            if (existingBase) {
              throw new ConflictException({
                code: 'UNIT_DIMENSION_BASE_UNIT_EXISTS',
                message: 'A Unit Dimension can have only one base unit',
              });
            }
          }

          const record = await tx.attributeUnit.create({
            data: {
              dimensionId,
              code: input.code,
              name: input.name.trim(),
              symbol: input.symbol.trim(),
              isBase: input.isBase ?? false,
              factorToBase: input.factorToBase ?? '1',
              offsetToBase: input.offsetToBase ?? '0',
              sortOrder: input.sortOrder ?? 0,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_UNIT_CREATED', 'AttributeUnit', record.id, {
            after: this.unitSnapshot(record),
          });
          return this.toUnit(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_UNIT_ALREADY_EXISTS', 'Unit code must be unique', 'ATTRIBUTE_UNIT_VERSION_CONFLICT');
    }
  }

  async updateUnit(
    dimensionId: string,
    unitId: string,
    input: UpdateAttributeUnitDto,
    actorId: string,
  ): Promise<AttributeUnitResponseDto> {
    this.assertChanges(
      input,
      ['name', 'symbol', 'isBase', 'factorToBase', 'offsetToBase', 'sortOrder', 'status'],
      'ATTRIBUTE_UNIT_UPDATE_EMPTY',
    );
    try {
      return await this.database.$transaction(
        async (tx) => {
          const [dimension, current] = await Promise.all([
            tx.unitDimension.findUnique({ where: { id: dimensionId } }),
            tx.attributeUnit.findFirst({ where: { id: unitId, dimensionId } }),
          ]);
          if (!dimension) throw this.notFound('UNIT_DIMENSION_NOT_FOUND', 'Unit Dimension was not found');
          if (!current) throw this.notFound('ATTRIBUTE_UNIT_NOT_FOUND', 'Unit was not found');
          this.assertVersion(current.version, input.version, 'ATTRIBUTE_UNIT_VERSION_CONFLICT');

          const nextStatus = input.status ?? current.status;
          const nextIsBase = input.isBase ?? current.isBase;
          const nextFactor = input.factorToBase ?? current.factorToBase.toString();
          const nextOffset = input.offsetToBase ?? current.offsetToBase.toString();
          this.assertActiveParent(nextStatus, dimension.status, 'UNIT_DIMENSION_NOT_ACTIVE', 'An active Unit requires an active Unit Dimension');
          this.assertBaseConversion(nextIsBase, nextFactor, nextOffset);

          if (nextIsBase && !current.isBase) {
            const existingBase = await tx.attributeUnit.findFirst({
              where: { dimensionId, isBase: true, id: { not: unitId } },
              select: { id: true },
            });
            if (existingBase) {
              throw new ConflictException({
                code: 'UNIT_DIMENSION_BASE_UNIT_EXISTS',
                message: 'A Unit Dimension can have only one base unit',
              });
            }
          }

          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const [attribute, assignment, value] = await Promise.all([
              tx.attributeDefinition.findFirst({
                where: { defaultUnitId: unitId, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
              tx.productTypeAttributeAssignment.findFirst({
                where: { defaultUnitId: unitId, status: MasterDataStatus.ACTIVE },
                select: { id: true },
              }),
              tx.productAttributeValue.findFirst({
                where: { unitId },
                select: { id: true },
              }),
            ]);
            if (attribute || assignment || value) {
              throw new ConflictException({
                code: 'ATTRIBUTE_UNIT_IN_USE',
                message: 'This Unit is still referenced by active schemas or product values',
              });
            }
          }

          const record = await tx.attributeUnit.update({
            where: { id: unitId, version: input.version },
            data: {
              name: input.name?.trim(),
              symbol: input.symbol?.trim(),
              isBase: input.isBase,
              factorToBase: input.factorToBase,
              offsetToBase: input.offsetToBase,
              sortOrder: input.sortOrder,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_UNIT_UPDATED', 'AttributeUnit', record.id, {
            before: this.unitSnapshot(current),
            after: this.unitSnapshot(record),
          });
          return this.toUnit(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_UNIT_ALREADY_EXISTS', 'Unit code must be unique', 'ATTRIBUTE_UNIT_VERSION_CONFLICT');
    }
  }

  async listAliases(
    attributeId: string,
    query: MasterStatusQueryDto,
  ): Promise<AttributeAliasResponseDto[]> {
    await this.requireAttribute(attributeId);
    return this.database.attributeAlias.findMany({
      where: { attributeId, status: query.status },
      select: aliasSelect,
      orderBy: [{ locale: 'asc' }, { alias: 'asc' }],
    });
  }

  async createAlias(
    attributeId: string,
    input: CreateAttributeAliasDto,
    actorId: string,
  ): Promise<AttributeAliasResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const attribute = await tx.attributeDefinition.findUnique({ where: { id: attributeId } });
          if (!attribute) throw this.notFound('ATTRIBUTE_NOT_FOUND', 'Attribute definition was not found');
          const status = input.status ?? MasterDataStatus.ACTIVE;
          this.assertActiveParent(status, attribute.status, 'ATTRIBUTE_NOT_ACTIVE', 'An active Alias requires an active Attribute');

          const alias = input.alias.trim();
          const record = await tx.attributeAlias.create({
            data: {
              attributeId,
              alias,
              normalizedAlias: this.normalizeAlias(alias),
              locale: input.locale ?? 'en',
              status,
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_ALIAS_CREATED', 'AttributeAlias', record.id, {
            after: this.aliasSnapshot(record),
          });
          return this.toAlias(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_ALIAS_ALREADY_EXISTS', 'This alias already exists for the Attribute and locale', 'ATTRIBUTE_ALIAS_VERSION_CONFLICT');
    }
  }

  async updateAlias(
    attributeId: string,
    aliasId: string,
    input: UpdateAttributeAliasDto,
    actorId: string,
  ): Promise<AttributeAliasResponseDto> {
    this.assertChanges(input, ['alias', 'locale', 'status'], 'ATTRIBUTE_ALIAS_UPDATE_EMPTY');
    try {
      return await this.database.$transaction(
        async (tx) => {
          const [attribute, current] = await Promise.all([
            tx.attributeDefinition.findUnique({ where: { id: attributeId } }),
            tx.attributeAlias.findFirst({ where: { id: aliasId, attributeId } }),
          ]);
          if (!attribute) throw this.notFound('ATTRIBUTE_NOT_FOUND', 'Attribute definition was not found');
          if (!current) throw this.notFound('ATTRIBUTE_ALIAS_NOT_FOUND', 'Attribute Alias was not found');
          this.assertVersion(current.version, input.version, 'ATTRIBUTE_ALIAS_VERSION_CONFLICT');
          this.assertActiveParent(
            input.status ?? current.status,
            attribute.status,
            'ATTRIBUTE_NOT_ACTIVE',
            'An active Alias requires an active Attribute',
          );

          const alias = input.alias?.trim();
          const record = await tx.attributeAlias.update({
            where: { id: aliasId, version: input.version },
            data: {
              alias,
              normalizedAlias:
                alias === undefined ? undefined : this.normalizeAlias(alias),
              locale: input.locale,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await this.audit(tx, actorId, 'ATTRIBUTE_ALIAS_UPDATED', 'AttributeAlias', record.id, {
            before: this.aliasSnapshot(current),
            after: this.aliasSnapshot(record),
          });
          return this.toAlias(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrow(error, 'ATTRIBUTE_ALIAS_ALREADY_EXISTS', 'This alias already exists for the Attribute and locale', 'ATTRIBUTE_ALIAS_VERSION_CONFLICT');
    }
  }

  private async requireOptionSet(id: string): Promise<void> {
    const record = await this.database.attributeOptionSet.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!record) throw this.notFound('ATTRIBUTE_OPTION_SET_NOT_FOUND', 'Option Set was not found');
  }

  private async requireDimension(id: string): Promise<void> {
    const record = await this.database.unitDimension.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!record) throw this.notFound('UNIT_DIMENSION_NOT_FOUND', 'Unit Dimension was not found');
  }

  private async requireAttribute(id: string): Promise<void> {
    const record = await this.database.attributeDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!record) throw this.notFound('ATTRIBUTE_NOT_FOUND', 'Attribute definition was not found');
  }

  private assertChanges(
    input: object,
    fields: string[],
    code: string,
  ): void {
    if (!fields.some((field) => (input as Record<string, unknown>)[field] !== undefined)) {
      throw new BadRequestException({
        code,
        message: 'At least one mutable field must be supplied',
      });
    }
  }

  private assertVersion(actual: number, expected: number, code: string): void {
    if (actual !== expected) {
      throw new ConflictException({
        code,
        message: 'The record changed; reload it before trying again',
      });
    }
  }

  private assertActiveParent(
    childStatus: MasterDataStatus,
    parentStatus: MasterDataStatus,
    code: string,
    message: string,
  ): void {
    if (
      childStatus === MasterDataStatus.ACTIVE &&
      parentStatus !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({ code, message });
    }
  }

  private assertBaseConversion(
    isBase: boolean,
    factorToBase: string,
    offsetToBase: string,
  ): void {
    if (!isBase) return;
    if (new Prisma.Decimal(factorToBase).cmp(1) !== 0 || new Prisma.Decimal(offsetToBase).cmp(0) !== 0) {
      throw new BadRequestException({
        code: 'ATTRIBUTE_BASE_UNIT_CONVERSION_INVALID',
        message: 'A base unit must use factorToBase=1 and offsetToBase=0',
      });
    }
  }

  private optionalText(value: string | null | undefined): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeAlias(value: string): string {
    return value
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/\s+/gu, ' ');
  }

  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message });
  }

  private rethrow(
    error: unknown,
    duplicateCode: string,
    duplicateMessage: string,
    versionCode: string,
  ): never {
    if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({ code: duplicateCode, message: duplicateMessage });
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

  private audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<unknown> {
    return tx.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata },
    });
  }

  private groupSnapshot(record: AttributeGroup): Prisma.InputJsonObject {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      sortOrder: record.sortOrder,
      status: record.status,
      version: record.version,
    };
  }

  private optionSetSnapshot(record: AttributeOptionSet): Prisma.InputJsonObject {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
      version: record.version,
    };
  }

  private optionValueSnapshot(record: AttributeOptionValue): Prisma.InputJsonObject {
    return {
      id: record.id,
      optionSetId: record.optionSetId,
      code: record.code,
      label: record.label,
      description: record.description,
      sortOrder: record.sortOrder,
      status: record.status,
      version: record.version,
    };
  }

  private dimensionSnapshot(record: UnitDimension): Prisma.InputJsonObject {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
      version: record.version,
    };
  }

  private unitSnapshot(record: AttributeUnit): Prisma.InputJsonObject {
    return {
      id: record.id,
      dimensionId: record.dimensionId,
      code: record.code,
      name: record.name,
      symbol: record.symbol,
      isBase: record.isBase,
      factorToBase: record.factorToBase.toString(),
      offsetToBase: record.offsetToBase.toString(),
      sortOrder: record.sortOrder,
      status: record.status,
      version: record.version,
    };
  }

  private aliasSnapshot(record: AttributeAlias): Prisma.InputJsonObject {
    return {
      id: record.id,
      attributeId: record.attributeId,
      alias: record.alias,
      normalizedAlias: record.normalizedAlias,
      locale: record.locale,
      status: record.status,
      version: record.version,
    };
  }

  private toGroup(record: AttributeGroup): AttributeGroupResponseDto {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      sortOrder: record.sortOrder,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toOptionSet(record: AttributeOptionSet): AttributeOptionSetResponseDto {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toOptionValue(record: AttributeOptionValue): AttributeOptionValueResponseDto {
    return {
      id: record.id,
      optionSetId: record.optionSetId,
      code: record.code,
      label: record.label,
      description: record.description,
      sortOrder: record.sortOrder,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toDimension(record: UnitDimension): UnitDimensionResponseDto {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toUnit(record: AttributeUnit | AttributeUnitView): AttributeUnitResponseDto {
    return {
      id: record.id,
      dimensionId: record.dimensionId,
      code: record.code,
      name: record.name,
      symbol: record.symbol,
      isBase: record.isBase,
      factorToBase: record.factorToBase.toString(),
      offsetToBase: record.offsetToBase.toString(),
      sortOrder: record.sortOrder,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toAlias(record: AttributeAlias): AttributeAliasResponseDto {
    return {
      id: record.id,
      attributeId: record.attributeId,
      alias: record.alias,
      normalizedAlias: record.normalizedAlias,
      locale: record.locale,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
