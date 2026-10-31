import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  AdminSellerPageQueryDto,
  AdminSellerQueryDto,
  CreateSellerDto,
  SellerAdminSummaryResponseDto,
  SellerPageResponseDto,
  SellerResponseDto,
  UpdateSellerDto,
} from './dto/seller.dto.js';
import { SellerService } from './seller.service.js';

@ApiTags('Admin sellers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'seller.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('seller.manage')
@Controller('admin/sellers')
export class AdminSellerController {
  constructor(private readonly sellers: SellerService) {}

  @Get()
  @ApiOkResponse({ type: SellerResponseDto, isArray: true })
  list(@Query() query: AdminSellerQueryDto): Promise<SellerResponseDto[]> {
    return this.sellers.listAdmin(query);
  }

  @Get('page')
  @ApiOkResponse({ type: SellerPageResponseDto })
  listPage(
    @Query() query: AdminSellerPageQueryDto,
  ): Promise<SellerPageResponseDto> {
    return this.sellers.listAdminPage(query);
  }

  @Get('summary')
  @ApiOkResponse({ type: SellerAdminSummaryResponseDto })
  summary(): Promise<SellerAdminSummaryResponseDto> {
    return this.sellers.getAdminSummary();
  }

  @Get(':id')
  @ApiOkResponse({ type: SellerResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<SellerResponseDto> {
    return this.sellers.getAdmin(id);
  }

  @Post()
  @ApiCreatedResponse({ type: SellerResponseDto })
  create(
    @Body() input: CreateSellerDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerResponseDto> {
    return this.sellers.createAdmin(input, principal.userId);
  }

  @Patch(':id')
  @ApiOkResponse({ type: SellerResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSellerDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerResponseDto> {
    return this.sellers.updateAdmin(id, input, principal.userId);
  }
}
