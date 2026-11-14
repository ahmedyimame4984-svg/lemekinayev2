import { UseGuards } from '@nestjs/common';
import { CanonicalReferenceReadOnlyGuard } from '../reference-sync/canonical-reference-readonly.guard.js';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentPrincipal, RequireAccountTypes, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CreateGenerationFamilyDto, CreateGenerationFamilyEvidenceDto,
  GenerationFamilyPageQueryDto, GenerationFamilyPageResponseDto, GenerationFamilyResponseDto,
  GenerationFamilyVersionDto, ReviewGenerationFamilyEvidenceDto,
  SetGenerationFamilyMembersDto, UpdateGenerationFamilyDto,
} from './dto/generation-family.dto.js';
import { GenerationFamilyService } from './generation-family.service.js';

@ApiTags('Admin Generation Families')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Admin vehicle.manage permission required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('vehicle.manage')
@UseGuards(CanonicalReferenceReadOnlyGuard)
@Controller('admin/vehicles/generation-families')
export class AdminGenerationFamilyController {
  constructor(private readonly families: GenerationFamilyService) {}

  @Get('page')
  @ApiOperation({ summary: 'Search Generation Families with Model context' })
  @ApiOkResponse({ type: GenerationFamilyPageResponseDto })
  page(@Query() query: GenerationFamilyPageQueryDto) {
    return this.families.listPage(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Inspect one Family, assigned Generations and source evidence' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.families.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create one DRAFT Generation Family in an existing Model' })
  @ApiCreatedResponse({ type: GenerationFamilyResponseDto })
  create(@Body() input: CreateGenerationFamilyDto, @CurrentPrincipal() actor: AuthPrincipal) {
    return this.families.create(input, actor.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit Draft Family metadata with optimistic versioning' })
  @ApiOkResponse({ type: GenerationFamilyResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateGenerationFamilyDto, @CurrentPrincipal() actor: AuthPrincipal) {
    return this.families.update(id, input, actor.userId);
  }

  @Patch(':id/members')
  @ApiOperation({ summary: 'Explicitly save same-Model Generation assignments in one transaction' })
  members(@Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetGenerationFamilyMembersDto, @CurrentPrincipal() actor: AuthPrincipal) {
    return this.families.setMembers(id, input, actor.userId);
  }

  @Post(':id/evidence')
  @ApiOperation({ summary: 'Submit documentary evidence as UNVERIFIED' })
  evidence(@Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateGenerationFamilyEvidenceDto, @CurrentPrincipal() actor: AuthPrincipal) {
    return this.families.addEvidence(id, input, actor.userId);
  }

  @Post(':id/evidence/:evidenceId/review')
  @ApiOperation({ summary: 'Independently verify or reject technical evidence' })
  review(@Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() input: ReviewGenerationFamilyEvidenceDto, @CurrentPrincipal() actor: AuthPrincipal) {
    return this.families.reviewEvidence(id, evidenceId, input, actor.userId);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate one reviewed Family; fail closed on missing evidence or Generations' })
  @ApiOkResponse({ type: GenerationFamilyResponseDto })
  activate(@Param('id', ParseUUIDPipe) id: string,
    @Body() input: GenerationFamilyVersionDto, @CurrentPrincipal() actor: AuthPrincipal) {
    return this.families.activate(id, input.version, actor.userId);
  }
}
