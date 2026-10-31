import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import { CatalogHealthService } from './catalog-health.service.js';
import {
  CatalogHealthResponseDto,
  CatalogQualityFindingPageDto,
  CatalogQualityFindingQueryDto,
} from './dto/catalog-health.dto.js';

@ApiTags('Admin catalog health')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({
  description: 'catalog.manage and vehicle.manage are required',
})
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage', 'vehicle.manage')
@Controller('admin/catalog/health')
export class CatalogHealthController {
  constructor(private readonly health: CatalogHealthService) {}

  @Get()
  @ApiOperation({
    summary:
      'Read actionable catalog, Article, OE-reference and vehicle quality signals',
  })
  @ApiOkResponse({ type: CatalogHealthResponseDto })
  getHealth(): Promise<CatalogHealthResponseDto> {
    return this.health.getHealth();
  }

  @Get('findings')
  @ApiOperation({
    summary:
      'Page the affected canonical records behind one Catalog Health issue',
  })
  @ApiOkResponse({ type: CatalogQualityFindingPageDto })
  getFindings(
    @Query() query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    return this.health.getFindings(query);
  }
}
