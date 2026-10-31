import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { AdminSavedViewService } from './admin-saved-view.service.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherOwnerId = '22222222-2222-4222-8222-222222222222';
const viewId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-10-05T18:00:00.000Z');

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: viewId,
    scope: 'CATALOG_PRODUCT_TYPES',
    name: 'Draft brake parts',
    state: { status: 'DRAFT', sortBy: 'NAME', sortDirection: 'ASC' },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AdminSavedViewService', () => {
  it('lists only the current Admin views inside the requested scope', async () => {
    const findMany = vi.fn().mockResolvedValue([record()]);
    const database = {
      adminSavedView: { findMany },
    } as unknown as DatabaseService;
    const service = new AdminSavedViewService(database);

    await expect(
      service.list(ownerId, 'CATALOG_PRODUCT_TYPES'),
    ).resolves.toEqual([record()]);

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId, scope: 'CATALOG_PRODUCT_TYPES' },
      select: expect.any(Object),
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });
  });

  it('normalizes a saved-view name and stores its bounded object state', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) =>
      record({ name: data.name, state: data.state }),
    );
    const database = {
      adminSavedView: { create },
    } as unknown as DatabaseService;
    const service = new AdminSavedViewService(database);

    await expect(
      service.create(ownerId, {
        scope: 'CATALOG_PRODUCT_TYPES',
        name: '  Draft brake parts  ',
        state: { status: 'DRAFT', search: 'brake' },
      }),
    ).resolves.toMatchObject({
      name: 'Draft brake parts',
      state: { status: 'DRAFT', search: 'brake' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        ownerId,
        scope: 'CATALOG_PRODUCT_TYPES',
        name: 'Draft brake parts',
        state: { status: 'DRAFT', search: 'brake' },
      },
      select: expect.any(Object),
    });
  });

  it('rejects saved-view state larger than the preference limit before writing', async () => {
    const create = vi.fn();
    const database = {
      adminSavedView: { create },
    } as unknown as DatabaseService;
    const service = new AdminSavedViewService(database);

    await expect(
      service.create(ownerId, {
        scope: 'CATALOG_PRODUCT_TYPES',
        name: 'Too large',
        state: { search: 'x'.repeat(17_000) },
      }),
    ).rejects.toMatchObject({
      response: { code: 'ADMIN_SAVED_VIEW_STATE_TOO_LARGE' },
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('maps duplicate owner/scope/name persistence conflicts safely', async () => {
    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate saved view', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    const database = {
      adminSavedView: { create },
    } as unknown as DatabaseService;
    const service = new AdminSavedViewService(database);

    await expect(
      service.create(ownerId, {
        scope: 'CATALOG_PRODUCT_TYPES',
        name: 'Draft brake parts',
        state: {},
      }),
    ).rejects.toMatchObject({
      response: { code: 'ADMIN_SAVED_VIEW_NAME_CONFLICT' },
    });
  });

  it('rejects stale updates before any saved-view write', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: viewId,
      version: 3,
    });
    const update = vi.fn();
    const database = {
      adminSavedView: { findFirst, update },
    } as unknown as DatabaseService;
    const service = new AdminSavedViewService(database);

    await expect(
      service.update(ownerId, viewId, {
        version: 2,
        state: { status: 'ACTIVE' },
      }),
    ).rejects.toMatchObject({
      response: { code: 'ADMIN_SAVED_VIEW_VERSION_CONFLICT' },
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('does not allow one Admin to update another Admin saved view', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const database = {
      adminSavedView: { findFirst, update },
    } as unknown as DatabaseService;
    const service = new AdminSavedViewService(database);

    await expect(
      service.update(otherOwnerId, viewId, {
        version: 1,
        name: 'Other view',
      }),
    ).rejects.toMatchObject({
      response: { code: 'ADMIN_SAVED_VIEW_NOT_FOUND' },
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: viewId, ownerId: otherOwnerId },
      select: { id: true, version: true },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('deletes only an owner-matched view at the expected version', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: viewId,
      version: 4,
    });
    const remove = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      adminSavedView: { findFirst, deleteMany: remove },
    } as unknown as DatabaseService;
    const service = new AdminSavedViewService(database);

    await expect(service.remove(ownerId, viewId, 4)).resolves.toBeUndefined();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: viewId, ownerId },
      select: { id: true, version: true },
    });
    expect(remove).toHaveBeenCalledWith({
      where: { id: viewId, ownerId, version: 4 },
    });
  });
});
