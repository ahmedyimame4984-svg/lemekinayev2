import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import {
  AdminArticleRelationCandidatePageDto,
  AdminArticleRelationCandidateQueryDto,
  AdminArticleRelationPageDto,
  AdminArticleRelationPageQueryDto,
  AdminArticleRelationSummaryDto,
  AdminCreateArticleRelationDto,
  AdminUpdateArticleRelationDto,
} from './dto/admin-article-relation-governance.dto.js';
import { ArticleRelationResponseDto } from './dto/article-relation.dto.js';
import { AdminArticleRelationGovernanceService } from './admin-article-relation-governance.service.js';

@ApiTags('Admin Article relation governance')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'catalog.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage')
@Controller('admin/catalog/article-relations')
export class AdminArticleRelationGovernanceController {
  constructor(
    private readonly governance: AdminArticleRelationGovernanceService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Read Article relation and supersession governance counts',
  })
  @ApiOkResponse({ type: AdminArticleRelationSummaryDto })
  summary(): Promise<AdminArticleRelationSummaryDto> {
    return this.governance.summary();
  }

  @Get('candidates')
  @ApiOperation({
    summary:
      'Search Manufacturer Articles for relation source/target selection with type-aware constraints',
  })
  @ApiOkResponse({ type: AdminArticleRelationCandidatePageDto })
  candidates(
    @Query() query: AdminArticleRelationCandidateQueryDto,
  ): Promise<AdminArticleRelationCandidatePageDto> {
    return this.governance.candidates(query);
  }

  @Get()
  @ApiOperation({
    summary:
      'Page canonical Manufacturer Article relations and supersession records',
  })
  @ApiOkResponse({ type: AdminArticleRelationPageDto })
  list(
    @Query() query: AdminArticleRelationPageQueryDto,
  ): Promise<AdminArticleRelationPageDto> {
    return this.governance.list(query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a governed Manufacturer Article relation using canonical semantic validation',
  })
  @ApiOkResponse({ type: ArticleRelationResponseDto })
  create(
    @Body() input: AdminCreateArticleRelationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ArticleRelationResponseDto> {
    return this.governance.create(input, principal.userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Update lifecycle/note/component metadata for a governed Manufacturer Article relation',
  })
  @ApiOkResponse({ type: ArticleRelationResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdminUpdateArticleRelationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ArticleRelationResponseDto> {
    return this.governance.update(id, input, principal.userId);
  }
}
