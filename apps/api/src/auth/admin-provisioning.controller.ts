import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { AdminAuthService } from './admin-auth.service.js';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from './auth.decorators.js';
import type { AuthPrincipal } from './auth.types.js';
import {
  AdminAccountPageQueryDto,
  AdminAccountPageResponseDto,
  AdminAccountSummaryResponseDto,
  AdminProvisioningResponseDto,
  ProvisionAdminDto,
  UpdateAdminAccountStatusDto,
} from './dto/admin-auth.dto.js';

@ApiTags('Admin accounts')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'admin.accounts.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('admin.accounts.manage')
@Controller('admin/accounts')
export class AdminProvisioningController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Get()
  @ApiOperation({ summary: 'List privileged Admin accounts' })
  @ApiOkResponse({ type: AdminAccountSummaryResponseDto, isArray: true })
  list(): Promise<AdminAccountSummaryResponseDto[]> {
    return this.adminAuth.listAdminAccounts();
  }

  @Get('page')
  @ApiOperation({ summary: 'Search and page privileged Admin accounts' })
  @ApiOkResponse({ type: AdminAccountPageResponseDto })
  listPage(
    @Query() query: AdminAccountPageQueryDto,
  ): Promise<AdminAccountPageResponseDto> {
    return this.adminAuth.listAdminAccountsPage(query);
  }

  @Patch(':userId/status')
  @ApiOperation({ summary: 'Change an Admin account lifecycle status' })
  @ApiOkResponse({ type: AdminAccountSummaryResponseDto })
  updateStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: UpdateAdminAccountStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminAccountSummaryResponseDto> {
    return this.adminAuth.updateAdminAccountStatus(
      userId,
      input,
      principal.userId,
    );
  }

  @Post('provision')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Provision a privileged Admin account' })
  @ApiCreatedResponse({ type: AdminProvisioningResponseDto })
  @ApiConflictResponse({ description: 'The account cannot be provisioned' })
  provision(
    @Body() input: ProvisionAdminDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminProvisioningResponseDto> {
    return this.adminAuth.provisionAdmin(input, principal.userId);
  }
}
