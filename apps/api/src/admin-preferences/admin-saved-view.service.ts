import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  AdminSavedViewResponseDto,
  CreateAdminSavedViewDto,
  UpdateAdminSavedViewDto,
} from './dto/admin-saved-view.dto.js';

const MAX_SAVED_VIEW_STATE_BYTES = 16_384;

const savedViewSelect = {
  id: true,
  scope: true,
  name: true,
  state: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminSavedViewSelect;

@Injectable()
export class AdminSavedViewService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    ownerId: string,
    scope: string,
  ): Promise<AdminSavedViewResponseDto[]> {
    const records = await this.database.adminSavedView.findMany({
      where: { ownerId, scope },
      select: savedViewSelect,
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });
    return records.map((record) => this.toResponse(record));
  }

  async create(
    ownerId: string,
    input: CreateAdminSavedViewDto,
  ): Promise<AdminSavedViewResponseDto> {
    const name = this.normalizeName(input.name);
    this.assertStateSize(input.state);

    try {
      const record = await this.database.adminSavedView.create({
        data: {
          ownerId,
          scope: input.scope,
          name,
          state: input.state as Prisma.InputJsonValue,
        },
        select: savedViewSelect,
      });
      return this.toResponse(record);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(
    ownerId: string,
    id: string,
    input: UpdateAdminSavedViewDto,
  ): Promise<AdminSavedViewResponseDto> {
    if (input.name === undefined && input.state === undefined) {
      throw new BadRequestException({
        code: 'ADMIN_SAVED_VIEW_UPDATE_EMPTY',
        message: 'Provide a saved view name or state to update',
      });
    }
    if (input.state !== undefined) this.assertStateSize(input.state);

    const current = await this.database.adminSavedView.findFirst({
      where: { id, ownerId },
      select: { id: true, version: true },
    });
    if (!current) throw this.notFound();
    if (current.version !== input.version) throw this.versionConflict();

    try {
      const record = await this.database.adminSavedView.update({
        where: { id, version: input.version },
        data: {
          name:
            input.name === undefined
              ? undefined
              : this.normalizeName(input.name),
          state:
            input.state === undefined
              ? undefined
              : (input.state as Prisma.InputJsonValue),
          version: { increment: 1 },
        },
        select: savedViewSelect,
      });
      return this.toResponse(record);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async remove(ownerId: string, id: string, version: number): Promise<void> {
    const current = await this.database.adminSavedView.findFirst({
      where: { id, ownerId },
      select: { id: true, version: true },
    });
    if (!current) throw this.notFound();
    if (current.version !== version) throw this.versionConflict();

    const deleted = await this.database.adminSavedView.deleteMany({
      where: { id, ownerId, version },
    });
    if (deleted.count !== 1) throw this.versionConflict();
  }

  private normalizeName(value: string): string {
    const name = value.trim();
    if (!name) {
      throw new BadRequestException({
        code: 'ADMIN_SAVED_VIEW_NAME_REQUIRED',
        message: 'Saved view name is required',
      });
    }
    return name;
  }

  private assertStateSize(state: Record<string, unknown>): void {
    const size = Buffer.byteLength(JSON.stringify(state), 'utf8');
    if (size > MAX_SAVED_VIEW_STATE_BYTES) {
      throw new BadRequestException({
        code: 'ADMIN_SAVED_VIEW_STATE_TOO_LARGE',
        message: 'Saved view state is too large',
      });
    }
  }

  private toResponse(
    record: Prisma.AdminSavedViewGetPayload<{ select: typeof savedViewSelect }>,
  ): AdminSavedViewResponseDto {
    return {
      ...record,
      state: record.state as Record<string, unknown>,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'ADMIN_SAVED_VIEW_NOT_FOUND',
      message: 'Saved view not found',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'ADMIN_SAVED_VIEW_VERSION_CONFLICT',
      message: 'Saved view changed. Reload it and try again.',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          code: 'ADMIN_SAVED_VIEW_NAME_CONFLICT',
          message:
            'A saved view with this name already exists in this workspace',
        });
      }
      if (error.code === 'P2025') {
        throw this.versionConflict();
      }
    }
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    throw error;
  }
}
