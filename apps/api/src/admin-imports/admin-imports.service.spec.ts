import { AccountStatus, AccountType } from '@prisma/client';
import type { AuthPrincipal } from '../auth/auth.types.js';
import type { DatabaseService } from '../database/database.service.js';
import { AdminImportsService } from './admin-imports.service.js';
import { AdminImportWorkflow } from './dto/admin-import-job.dto.js';

describe('AdminImportsService', () => {
  const adminImportJob = {
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const service = new AdminImportsService({
    adminImportJob,
  } as unknown as DatabaseService);

  const principal = (
    permissions: string[],
  ): AuthPrincipal => ({
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    accountType: AccountType.ADMIN,
    status: AccountStatus.ACTIVE,
    roles: ['admin'],
    permissions,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    adminImportJob.count.mockResolvedValue(0);
    adminImportJob.findMany.mockResolvedValue([]);
  });

  it('limits job history to workflows granted by domain permissions', async () => {
    await service.listJobs(
      { page: 1, pageSize: 25 },
      principal(['catalog.manage']),
    );

    expect(adminImportJob.count).toHaveBeenCalledWith({
      where: {
        workflow: {
          in: [
            AdminImportWorkflow.ATTRIBUTE_LIBRARY,
            AdminImportWorkflow.PRODUCT_TYPE_LIBRARY,
            AdminImportWorkflow.MANUFACTURER_ARTICLE,
          ],
        },
      },
    });
    expect(adminImportJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workflow: {
            in: [
              AdminImportWorkflow.ATTRIBUTE_LIBRARY,
              AdminImportWorkflow.PRODUCT_TYPE_LIBRARY,
              AdminImportWorkflow.MANUFACTURER_ARTICLE,
            ],
          },
        },
      }),
    );
  });

  it('returns no metadata when the requested workflow is outside permissions', async () => {
    await expect(
      service.listJobs(
        {
          workflow: AdminImportWorkflow.CONFIGURED_VEHICLE_LIBRARY,
          page: 1,
          pageSize: 25,
        },
        principal(['catalog.manage']),
      ),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      pageCount: 0,
    });

    expect(adminImportJob.count).not.toHaveBeenCalled();
    expect(adminImportJob.findMany).not.toHaveBeenCalled();
  });

  it('pages permitted jobs deterministically', async () => {
    adminImportJob.count.mockResolvedValue(51);
    adminImportJob.findMany.mockResolvedValue([
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        workflow: AdminImportWorkflow.CONFIGURED_VEHICLE_LIBRARY,
        datasetReference: null,
        fileName: 'vehicles.csv',
        fileFormat: 'CSV',
        status: 'COMPLETED',
        totalRows: 25,
        includedRows: 25,
        excludedRows: 0,
        warningRows: 0,
        createdCount: 25,
        createdAt: new Date('2026-10-07T10:00:00.000Z'),
      },
    ]);

    const result = await service.listJobs(
      {
        workflow: AdminImportWorkflow.CONFIGURED_VEHICLE_LIBRARY,
        page: 2,
        pageSize: 25,
      },
      principal(['vehicle.manage']),
    );

    expect(result.pageCount).toBe(3);
    expect(result.total).toBe(51);
    expect(adminImportJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});
