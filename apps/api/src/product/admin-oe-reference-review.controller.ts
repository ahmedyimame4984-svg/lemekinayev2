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
import {
  AdminOeCollisionPageDto,
  AdminOeCollisionPageQueryDto,
  AdminOeReferenceSummaryDto,
  AdminReferencePageDto,
  AdminReferenceSearchQueryDto,
} from './dto/admin-oe-reference-review.dto.js';
import { AdminOeReferenceReviewService } from './admin-oe-reference-review.service.js';

@ApiTags('Admin OE and cross-reference review')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({
  description: 'catalog.manage and seller.manage are required',
})
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage', 'seller.manage')
@Controller('admin/catalog/oe-references')
export class AdminOeReferenceReviewController {
  constructor(private readonly review: AdminOeReferenceReviewService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Read OE/cross-reference health counts for canonical Manufacturer Article governance',
  })
  @ApiOkResponse({ type: AdminOeReferenceSummaryDto })
  summary(): Promise<AdminOeReferenceSummaryDto> {
    return this.review.summary();
  }

  @Get('collisions')
  @ApiOperation({
    summary:
      'Page ambiguous OE groups that map the same issuer number to multiple live Articles',
  })
  @ApiOkResponse({ type: AdminOeCollisionPageDto })
  collisions(
    @Query() query: AdminOeCollisionPageQueryDto,
  ): Promise<AdminOeCollisionPageDto> {
    return this.review.listCollisions(query);
  }

  @Get('references')
  @ApiOperation({
    summary:
      'Search and page Manufacturer/OE/cross-reference evidence with canonical Article context',
  })
  @ApiOkResponse({ type: AdminReferencePageDto })
  references(
    @Query() query: AdminReferenceSearchQueryDto,
  ): Promise<AdminReferencePageDto> {
    return this.review.searchReferences(query);
  }
}
