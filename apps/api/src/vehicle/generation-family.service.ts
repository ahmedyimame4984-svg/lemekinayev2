import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MasterDataStatus, Prisma, ProvenanceVerificationState, VehicleProductionEndStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  CreateGenerationFamilyDto,
  CreateGenerationFamilyEvidenceDto,
  GenerationFamilyPageQueryDto,
  GenerationFamilyPageResponseDto,
  GenerationFamilyResponseDto,
  ReviewGenerationFamilyEvidenceDto,
  SetGenerationFamilyMembersDto,
  UpdateGenerationFamilyDto,
} from './dto/generation-family.dto.js';

const familySelect = {
  id: true, modelId: true, code: true, name: true,
  startYear: true, endYear: true, endStatus: true,
  status: true, version: true, createdAt: true, updatedAt: true, updatedById: true,
  model: { select: { name: true, make: { select: { name: true } } } },
  _count: { select: { generations: true } },
} satisfies Prisma.VehicleGenerationFamilySelect;
type FamilyRow = Prisma.VehicleGenerationFamilyGetPayload<{ select: typeof familySelect }>;

const FAMILY_ENTITY = 'VehicleGenerationFamily';

@Injectable()
export class GenerationFamilyService {
  constructor(private readonly db: DatabaseService) {}

  async listPage(query: GenerationFamilyPageQueryDto): Promise<GenerationFamilyPageResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const search = query.search?.trim();
    const where: Prisma.VehicleGenerationFamilyWhereInput = {
      modelId: query.modelId,
      ...(query.makeId ? { model: { makeId: query.makeId } } : {}),
      status: query.status,
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { model: { name: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.db.vehicleGenerationFamily.count({ where }),
      this.db.vehicleGenerationFamily.findMany({
        where, select: familySelect,
        orderBy: [{ modelId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    return { items: rows.map((row) => this.toResponse(row)), total, page, pageSize,
      pageCount: total ? Math.ceil(total / pageSize) : 0 };
  }

  async get(id: string) {
    const family = await this.db.vehicleGenerationFamily.findUnique({
      where: { id }, select: familySelect,
    });
    if (!family) throw this.notFound();
    const [generations, evidence] = await Promise.all([
      this.db.vehicleGeneration.findMany({
        where: { familyId: id, modelId: family.modelId },
        select: { id: true, modelId: true, derivativeId: true, name: true, code: true, status: true, version: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.db.masterDataProvenance.findMany({
        where: { entityType: FAMILY_ENTITY, entityId: id },
        select: { id: true, sourceName: true, sourceReference: true, sourceUrl: true,
          notes: true, verificationState: true, version: true, createdById: true,
          createdAt: true, updatedAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    ]);
    return { ...this.toResponse(family), generations, evidence };
  }

  async create(input: CreateGenerationFamilyDto, actorId: string): Promise<GenerationFamilyResponseDto> {
    const name = input.name.trim();
    const endStatus = input.endStatus ?? (input.endYear == null
      ? VehicleProductionEndStatus.UNKNOWN : VehicleProductionEndStatus.ENDED);
    this.assertPeriod(input.startYear ?? null, input.endYear ?? null, endStatus);
    try {
      const id = await this.db.$transaction(async (tx) => {
        const model = await tx.vehicleModel.findUnique({ where: { id: input.modelId }, select: { id: true } });
        if (!model) throw new BadRequestException({
          code: 'GENERATION_FAMILY_MODEL_NOT_FOUND', message: 'Choose an existing vehicle Model.',
        });
        const duplicate = await tx.vehicleGenerationFamily.findFirst({
          where: { modelId: input.modelId, name: { equals: name, mode: 'insensitive' } },
          select: { id: true },
        });
        if (duplicate) throw new ConflictException({
          code: 'GENERATION_FAMILY_DUPLICATE', message: 'A Family with this name already exists for the Model.',
        });
        const code = this.generatedCode(name);
        const family = await tx.vehicleGenerationFamily.create({
          data: { modelId: model.id, code, name, startYear: input.startYear ?? null,
            endYear: input.endYear ?? null, endStatus, status: MasterDataStatus.DRAFT,
            createdById: actorId, updatedById: actorId },
          select: { id: true },
        });
        await tx.auditLog.create({ data: { actorId, action: 'GENERATION_FAMILY_CREATED',
          entityType: FAMILY_ENTITY, entityId: family.id, metadata: { modelId: model.id, code, name } } });
        return family.id;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      const row = await this.db.vehicleGenerationFamily.findUniqueOrThrow({ where: { id }, select: familySelect });
      return this.toResponse(row);
    } catch (error) { return this.handlePersistence(error); }
  }

  async update(id: string, input: UpdateGenerationFamilyDto, actorId: string): Promise<GenerationFamilyResponseDto> {
    if (input.name === undefined && input.startYear === undefined && input.endYear === undefined && input.endStatus === undefined) {
      throw new BadRequestException({ code: 'GENERATION_FAMILY_UPDATE_EMPTY', message: 'No changes supplied.' });
    }
    try {
      await this.db.$transaction(async (tx) => {
        const current = await tx.vehicleGenerationFamily.findUnique({ where: { id } });
        if (!current) throw this.notFound();
        this.assertDraftVersion(current.status, current.version, input.version);
        const startYear = input.startYear === undefined ? current.startYear : input.startYear;
        const endYear = input.endYear === undefined ? current.endYear : input.endYear;
        const endStatus = input.endStatus ?? current.endStatus;
        this.assertPeriod(startYear, endYear, endStatus);
        const name = input.name?.trim() ?? current.name;
        const metadataChanged = name !== current.name || startYear !== current.startYear || endYear !== current.endYear || endStatus !== current.endStatus;
        if (name !== current.name) {
          const duplicate = await tx.vehicleGenerationFamily.findFirst({
            where: { modelId: current.modelId, id: { not: id },
              name: { equals: name, mode: 'insensitive' } }, select: { id: true },
          });
          if (duplicate) throw new ConflictException({ code: 'GENERATION_FAMILY_DUPLICATE',
            message: 'Another Family with this name already exists for the Model.' });
        }
        const changed = await tx.vehicleGenerationFamily.updateMany({
          where: { id, version: input.version, status: MasterDataStatus.DRAFT },
          data: { name, startYear, endYear, endStatus, updatedById: metadataChanged ? actorId : current.updatedById, version: { increment: 1 } },
        });
        if (changed.count !== 1) throw this.conflict();
        if (metadataChanged) {
          await this.invalidateEvidence(tx, id, actorId);
        }
        await tx.auditLog.create({ data: { actorId, action: 'GENERATION_FAMILY_UPDATED',
          entityType: FAMILY_ENTITY, entityId: id,
          metadata: { before: { name: current.name, startYear: current.startYear, endYear: current.endYear,
            endStatus: current.endStatus }, after: { name, startYear, endYear, endStatus } } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      const row = await this.db.vehicleGenerationFamily.findUniqueOrThrow({ where: { id }, select: familySelect });
      return this.toResponse(row);
    } catch (error) { return this.handlePersistence(error); }
  }

  async setMembers(id: string, input: SetGenerationFamilyMembersDto, actorId: string) {
    try {
      await this.db.$transaction(async (tx) => {
        const family = await tx.vehicleGenerationFamily.findUnique({ where: { id } });
        if (!family) throw this.notFound();
        this.assertDraftVersion(family.status, family.version, input.version);
        // Explicit full list from the selected Model only. Never infer mappings by name, year or market.
        const candidates = await tx.vehicleGeneration.findMany({
          where: { OR: [{ id: { in: input.generationIds } }, { familyId: id }] },
          select: { id: true, modelId: true, familyId: true, version: true, status: true },
        });
        const requested = new Set(input.generationIds);
        const found = new Set(candidates.map((row) => row.id));
        if ([...requested].some((generationId) => !found.has(generationId)) || candidates.some((row) => row.modelId !== family.modelId && requested.has(row.id))) {
          throw new BadRequestException({ code: 'GENERATION_FAMILY_INVALID_MEMBERS',
            message: 'Every selected Generation must belong to the Family’s Model.' });
        }
        if (candidates.some((row) => requested.has(row.id) && row.familyId && row.familyId !== id)) {
          throw new ConflictException({ code: 'GENERATION_FAMILY_ALREADY_ASSIGNED',
            message: 'A selected Generation already belongs to a different Family.' });
        }
        const changed = candidates.filter((row) => (row.familyId === id) !== requested.has(row.id));
        if (changed.some((row) => row.status === MasterDataStatus.ARCHIVED || row.status === MasterDataStatus.SUPERSEDED)) {
          throw new ConflictException({ code: 'GENERATION_FAMILY_MEMBER_LOCKED',
            message: 'Archived or superseded Generations cannot have their Family assignment changed.' });
        }
        for (const row of changed) {
          const target = requested.has(row.id) ? id : null;
          const result = await tx.vehicleGeneration.updateMany({
            where: { id: row.id, modelId: family.modelId, familyId: row.familyId, version: row.version },
            data: { familyId: target, version: { increment: 1 }, updatedById: actorId },
          });
          if (result.count !== 1) throw this.conflict();
          await tx.auditLog.create({ data: { actorId, action: 'GENERATION_FAMILY_MEMBERSHIP_CHANGED',
            entityType: 'VehicleGeneration', entityId: row.id,
            metadata: { modelId: family.modelId, fromFamilyId: row.familyId, toFamilyId: target } } });
        }
        // Version bump serializes concurrent membership edits against one Family.
        const updated = await tx.vehicleGenerationFamily.updateMany({
          where: { id, version: input.version, status: MasterDataStatus.DRAFT },
          data: { version: { increment: 1 }, updatedById: changed.length > 0 ? actorId : family.updatedById },
        });
        if (updated.count !== 1) throw this.conflict();
        if (changed.length > 0) await this.invalidateEvidence(tx, id, actorId);
        await tx.auditLog.create({ data: { actorId, action: 'GENERATION_FAMILY_MEMBERS_SAVED',
          entityType: FAMILY_ENTITY, entityId: id,
          metadata: { requestedGenerationIds: [...requested], changedGenerationIds: changed.map((row) => row.id) } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.get(id);
    } catch (error) { return this.handlePersistence(error); }
  }

  async addEvidence(id: string, input: CreateGenerationFamilyEvidenceDto, actorId: string) {
    if (!input.sourceReference?.trim() && !input.sourceUrl?.trim()) {
      throw new BadRequestException({ code: 'GENERATION_FAMILY_EVIDENCE_REFERENCE_REQUIRED',
        message: 'Provide a documentary reference or a source URL.' });
    }
    try {
      await this.db.$transaction(async (tx) => {
        const family = await tx.vehicleGenerationFamily.findUnique({ where: { id }, select: { status: true } });
        if (!family) throw this.notFound();
        if (family.status !== MasterDataStatus.DRAFT) throw this.locked();
        const record = await tx.masterDataProvenance.create({ data: {
          entityType: FAMILY_ENTITY, entityId: id, sourceName: input.sourceName.trim(),
          sourceReference: input.sourceReference?.trim() || null,
          sourceUrl: input.sourceUrl?.trim() || null,
          notes: input.notes?.trim() || null,
          verificationState: ProvenanceVerificationState.UNVERIFIED,
          createdById: actorId, updatedById: actorId,
        } });
        await tx.auditLog.create({ data: { actorId, action: 'GENERATION_FAMILY_EVIDENCE_ADDED',
          entityType: FAMILY_ENTITY, entityId: id,
          metadata: { evidenceId: record.id, sourceName: record.sourceName } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.get(id);
    } catch (error) { return this.handlePersistence(error); }
  }

  async reviewEvidence(id: string, evidenceId: string, input: ReviewGenerationFamilyEvidenceDto, actorId: string) {
    try {
      await this.db.$transaction(async (tx) => {
        const family = await tx.vehicleGenerationFamily.findUnique({ where: { id }, select: { status: true, updatedById: true, version: true } });
        if (!family) throw this.notFound();
        if (family.status !== MasterDataStatus.DRAFT) throw this.locked();
        if (family.version !== input.familyVersion) throw this.conflict();
        const evidence = await tx.masterDataProvenance.findUnique({ where: { id: evidenceId } });
        if (!evidence || evidence.entityType !== FAMILY_ENTITY || evidence.entityId !== id) throw this.notFound();
        if (evidence.version !== input.version) throw this.conflict();
        if (evidence.createdById === actorId || family.updatedById === actorId) {
          throw new ConflictException({ code: 'GENERATION_FAMILY_SELF_REVIEW_BLOCKED',
            message: 'An Admin who did not submit this evidence or last edit the Family must review it.' });
        }
        if (evidence.verificationState === ProvenanceVerificationState.VERIFIED) {
          throw new ConflictException({ code: 'GENERATION_FAMILY_EVIDENCE_ALREADY_VERIFIED',
            message: 'Verified evidence cannot be silently reclassified.' });
        }
        const updated = await tx.masterDataProvenance.updateMany({
          where: { id: evidenceId, version: input.version, entityType: FAMILY_ENTITY, entityId: id },
          data: { verificationState: input.decision, version: { increment: 1 }, updatedById: actorId },
        });
        if (updated.count !== 1) throw this.conflict();
        await tx.auditLog.create({ data: { actorId, action: 'GENERATION_FAMILY_EVIDENCE_REVIEWED',
          entityType: FAMILY_ENTITY, entityId: id,
          metadata: { evidenceId, from: evidence.verificationState, to: input.decision } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.get(id);
    } catch (error) { return this.handlePersistence(error); }
  }

  async activate(id: string, version: number, actorId: string): Promise<GenerationFamilyResponseDto> {
    try {
      await this.db.$transaction(async (tx) => {
        const family = await tx.vehicleGenerationFamily.findUnique({ where: { id } });
        if (!family) throw this.notFound();
        if (family.version !== version) throw this.conflict();
        if (![MasterDataStatus.DRAFT, MasterDataStatus.DEPRECATED, MasterDataStatus.INACTIVE].includes(family.status as 'DRAFT' | 'DEPRECATED' | 'INACTIVE')) throw this.locked();
        this.assertPeriod(family.startYear, family.endYear, family.endStatus);
        const model = await tx.vehicleModel.findUnique({ where: { id: family.modelId }, select: { status: true } });
        if (model?.status !== MasterDataStatus.ACTIVE) throw new ConflictException({
          code: 'GENERATION_FAMILY_MODEL_NOT_ACTIVE', message: 'Activate the parent Model first.' });
        const [activeGenerations, verifiedEvidence] = await Promise.all([
          tx.vehicleGeneration.count({ where: { familyId: id, modelId: family.modelId, status: MasterDataStatus.ACTIVE } }),
          tx.masterDataProvenance.count({ where: { entityType: FAMILY_ENTITY, entityId: id,
            verificationState: ProvenanceVerificationState.VERIFIED } }),
        ]);
        if (activeGenerations < 1 || verifiedEvidence < 1) {
          throw new ConflictException({ code: 'GENERATION_FAMILY_NOT_READY',
            message: 'Activation requires at least one explicitly assigned ACTIVE Generation and independently VERIFIED source.' });
        }
        const updated = await tx.vehicleGenerationFamily.updateMany({
          where: { id, status: family.status, version },
          data: { status: MasterDataStatus.ACTIVE, version: { increment: 1 }, updatedById: actorId },
        });
        if (updated.count !== 1) throw this.conflict();
        await tx.auditLog.create({ data: { actorId, action: 'GENERATION_FAMILY_ACTIVATED',
          entityType: FAMILY_ENTITY, entityId: id,
          metadata: { activeGenerations, verifiedEvidence, from: family.status, to: 'ACTIVE' } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      const row = await this.db.vehicleGenerationFamily.findUniqueOrThrow({ where: { id }, select: familySelect });
      return this.toResponse(row);
    } catch (error) { return this.handlePersistence(error); }
  }

  private generatedCode(name: string): string {
    const normal = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
    return normal || `FAM_${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async invalidateEvidence(tx: Prisma.TransactionClient, id: string, actorId: string) {
    const result = await tx.masterDataProvenance.updateMany({
      where: { entityType: FAMILY_ENTITY, entityId: id, verificationState: ProvenanceVerificationState.VERIFIED },
      data: { verificationState: ProvenanceVerificationState.UNVERIFIED, version: { increment: 1 }, updatedById: actorId },
    });
    if (result.count > 0) await tx.auditLog.create({ data: {
      actorId, action: 'GENERATION_FAMILY_EVIDENCE_INVALIDATED', entityType: FAMILY_ENTITY, entityId: id,
      metadata: { reason: 'Family metadata or explicit Generation mappings changed', invalidatedSources: result.count },
    } });
  }

  private assertPeriod(start: number | null, end: number | null, status: VehicleProductionEndStatus) {
    if (start !== null && end !== null && start > end) {
      throw new BadRequestException({ code: 'GENERATION_FAMILY_YEAR_RANGE_INVALID',
        message: 'End year cannot precede start year.' });
    }
    if ((status === VehicleProductionEndStatus.ENDED && end === null) ||
        (status !== VehicleProductionEndStatus.ENDED && end !== null)) {
      throw new BadRequestException({ code: 'GENERATION_FAMILY_END_STATUS_INVALID',
        message: 'ENDED requires an end year; CURRENT and UNKNOWN require no end year.' });
    }
  }

  private assertDraftVersion(status: MasterDataStatus, version: number, requested: number) {
    if (version !== requested) throw this.conflict();
    if (status !== MasterDataStatus.DRAFT) throw this.locked();
  }

  private toResponse(row: FamilyRow): GenerationFamilyResponseDto {
    return { id: row.id, modelId: row.modelId, modelName: row.model.name,
      makeName: row.model.make.name, code: row.code, name: row.name,
      startYear: row.startYear, endYear: row.endYear, endStatus: row.endStatus,
      status: row.status, version: row.version, linkedCount: row._count.generations,
      createdAt: row.createdAt, updatedAt: row.updatedAt, updatedById: row.updatedById };
  }

  private notFound() {
    return new NotFoundException({ code: 'GENERATION_FAMILY_NOT_FOUND', message: 'Generation Family not found.' });
  }
  private locked() {
    return new ConflictException({ code: 'GENERATION_FAMILY_LOCKED',
      message: 'Only Draft Families may be edited or have membership/evidence changed.' });
  }
  private conflict() {
    return new ConflictException({ code: 'GENERATION_FAMILY_VERSION_CONFLICT',
      message: 'The record changed. Reload and try again.' });
  }
  private handlePersistence(error: unknown): never {
    if (error instanceof BadRequestException || error instanceof ConflictException ||
        error instanceof NotFoundException) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException({
        code: 'GENERATION_FAMILY_ALREADY_EXISTS', message: 'A Family with this code already exists for the Model.' });
      if (error.code === 'P2025' || error.code === 'P2034') throw this.conflict();
      if (error.code === 'P2003') throw new BadRequestException({
        code: 'GENERATION_FAMILY_INVALID_RELATION', message: 'A selected Model or Generation no longer exists.' });
    }
    throw error;
  }
}
