import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import {
  AdminImportWorkflow,
  type AdminImportJobPageQueryDto,
  type AdminImportJobPageResponseDto,
} from './dto/admin-import-job.dto.js';

@Injectable()
export class AdminImportsService {
  constructor(private readonly database: DatabaseService) {}

  async listJobs(
    query: AdminImportJobPageQueryDto,
    principal: AuthPrincipal,
  ): Promise<AdminImportJobPageResponseDto> {
    const permittedWorkflows = this.permittedWorkflows(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    if (
      permittedWorkflows.length === 0 ||
      (query.workflow && !permittedWorkflows.includes(query.workflow))
    ) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        pageCount: 0,
      };
    }

    const where: Prisma.AdminImportJobWhereInput = {
      workflow: query.workflow
        ? query.workflow
        : { in: permittedWorkflows },
    };

    const [total, items] = await Promise.all([
      this.database.adminImportJob.count({ where }),
      this.database.adminImportJob.findMany({
        where,
        select: {
          id: true,
          workflow: true,
          datasetReference: true,
          fileName: true,
          fileFormat: true,
          status: true,
          totalRows: true,
          includedRows: true,
          excludedRows: true,
          warningRows: true,
          createdCount: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        workflow: item.workflow as AdminImportWorkflow,
      })),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private permittedWorkflows(principal: AuthPrincipal): AdminImportWorkflow[] {
    const result: AdminImportWorkflow[] = [];
    if (principal.permissions.includes('catalog.manage')) {
      result.push(
        AdminImportWorkflow.ATTRIBUTE_LIBRARY,
        AdminImportWorkflow.PRODUCT_TYPE_LIBRARY,
        AdminImportWorkflow.MANUFACTURER_ARTICLE,
      );
    }
    if (principal.permissions.includes('vehicle.manage')) {
      result.push(AdminImportWorkflow.CONFIGURED_VEHICLE_LIBRARY);
    }
    return result;
  }
}
