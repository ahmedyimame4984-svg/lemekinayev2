import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { AuditEntityHistoryScope } from './dto/audit-log.dto.js';
import type {
  AuditEntityHistoryItemDto,
  AuditEntityHistoryQueryDto,
  AuditEntityHistoryResponseDto,
  AuditLogAdminPageQueryDto,
  AuditLogPageResponseDto,
  AuditLogResponseDto,
} from './dto/audit-log.dto.js';

const auditLogSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.AuditLogSelect;

type AuditLogRecord = Prisma.AuditLogGetPayload<{
  select: typeof auditLogSelect;
}>;

const SENSITIVE_METADATA_KEY =
  /(?:password|secret|ciphertext|nonce|authTag|accessToken|refreshToken|tokenHash)/iu;

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async listAdminAuditLogs(
    query: AuditLogAdminPageQueryDto,
  ): Promise<AuditLogPageResponseDto> {
    const search = query.search?.trim();
    const action = query.action?.trim();
    const entityType = query.entityType?.trim();
    const entityId = query.entityId?.trim();
    const actor = query.actor?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && to && from > to) {
      throw new BadRequestException({
        code: 'AUDIT_DATE_RANGE_INVALID',
        message: 'Audit history start date must be before the end date',
      });
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(actor
        ? {
            actor: {
              is: {
                OR: [
                  { name: { contains: actor, mode: 'insensitive' } },
                  { email: { contains: actor, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
              {
                actor: {
                  is: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      this.database.auditLog.count({ where }),
      this.database.auditLog.findMany({
        where,
        select: auditLogSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.toResponse(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    query: AuditEntityHistoryQueryDto,
  ): Promise<AuditEntityHistoryResponseDto> {
    const normalizedEntityType = entityType.trim();
    const normalizedEntityId = entityId.trim();
    const includeRelated = query.includeRelated ?? true;
    const limit = query.limit ?? 100;

    const related = includeRelated
      ? this.relatedEntityHistoryWhere(
          normalizedEntityType,
          normalizedEntityId,
        )
      : [];

    const records = await this.database.auditLog.findMany({
      where: {
        OR: [
          {
            entityType: normalizedEntityType,
            entityId: normalizedEntityId,
          },
          ...related,
        ],
      },
      select: auditLogSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return {
      entityType: normalizedEntityType,
      entityId: normalizedEntityId,
      items: records.map((record) =>
        this.toEntityHistoryItem(
          record,
          normalizedEntityType,
          normalizedEntityId,
        ),
      ),
    };
  }

  private relatedEntityHistoryWhere(
    entityType: string,
    entityId: string,
  ): Prisma.AuditLogWhereInput[] {
    const related: Prisma.AuditLogWhereInput[] = [
      {
        AND: [
          {
            metadata: {
              path: ['targetEntityType'],
              equals: entityType,
            },
          },
          {
            metadata: {
              path: ['targetEntityId'],
              equals: entityId,
            },
          },
        ],
      },
    ];

    if (entityType === 'Product') {
      related.push(
        {
          metadata: {
            path: ['productId'],
            equals: entityId,
          },
        },
        {
          metadata: {
            path: ['sourceArticleId'],
            equals: entityId,
          },
        },
        {
          metadata: {
            path: ['targetArticleId'],
            equals: entityId,
          },
        },
      );
    }

    if (entityType === 'ProductType') {
      related.push(
        {
          metadata: {
            path: ['productTypeId'],
            equals: entityId,
          },
        },
        {
          metadata: {
            path: ['before', 'productTypeId'],
            equals: entityId,
          },
        },
        {
          metadata: {
            path: ['after', 'productTypeId'],
            equals: entityId,
          },
        },
      );
    }

    if (entityType === 'VehicleConfiguration') {
      related.push({
        metadata: {
          path: ['vehicleConfigurationId'],
          equals: entityId,
        },
      });
    }

    return related;
  }

  private toEntityHistoryItem(
    record: AuditLogRecord,
    requestedEntityType: string,
    requestedEntityId: string,
  ): AuditEntityHistoryItemDto {
    const metadata = this.sanitizeMetadata(record.metadata);
    const before = this.metadataRecord(metadata, 'before');
    const after = this.metadataRecord(metadata, 'after');
    const root = this.isRecord(metadata) ? metadata : null;

    return {
      ...this.toResponse(record),
      metadata,
      scope:
        record.entityType === requestedEntityType &&
        record.entityId === requestedEntityId
          ? AuditEntityHistoryScope.SELF
          : AuditEntityHistoryScope.RELATED,
      versionBefore:
        this.numberValue(before?.version) ??
        this.numberValue(root?.previousVersion),
      versionAfter:
        this.numberValue(after?.version) ??
        this.numberValue(root?.nextVersion),
      lifecycleBefore:
        this.stringValue(before?.status) ??
        this.stringValue(root?.previousStatus),
      lifecycleAfter:
        this.stringValue(after?.status) ??
        this.stringValue(root?.status),
      changedFields: this.changedFields(before, after),
    };
  }

  private changedFields(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): string[] {
    const ignored = new Set(['createdAt', 'updatedAt']);
    if (!before && !after) return [];

    if (!before && after) {
      return Object.keys(after)
        .filter((key) => !ignored.has(key))
        .sort();
    }

    if (before && !after) {
      return Object.keys(before)
        .filter((key) => !ignored.has(key))
        .sort();
    }

    const keys = new Set([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ]);

    return [...keys]
      .filter((key) => !ignored.has(key))
      .filter(
        (key) =>
          JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]),
      )
      .sort();
  }

  private metadataRecord(
    metadata: Prisma.JsonValue | null,
    key: string,
  ): Record<string, unknown> | null {
    if (!this.isRecord(metadata)) return null;
    const value = metadata[key];
    return this.isRecord(value) ? value : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private numberValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private toResponse(record: AuditLogRecord): AuditLogResponseDto {
    return {
      id: record.id,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      metadata: this.sanitizeMetadata(record.metadata),
      createdAt: record.createdAt,
      actor: record.actor,
    };
  }

  private sanitizeMetadata(
    value: Prisma.JsonValue | undefined,
  ): Prisma.JsonValue | null {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeMetadata(item));
    }
    if (typeof value === 'object') {
      const sanitized: Prisma.JsonObject = {};
      for (const [key, nested] of Object.entries(value)) {
        sanitized[key] = SENSITIVE_METADATA_KEY.test(key)
          ? '[REDACTED]'
          : this.sanitizeMetadata(nested);
      }
      return sanitized;
    }
    return value;
  }
}
