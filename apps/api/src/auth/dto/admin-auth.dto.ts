import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AccountStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const TOKEN_MIN_LENGTH = 40;
const TOKEN_MAX_LENGTH = 100;

export class ProvisionAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Platform Administrator' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/u, { message: 'name must contain a non-whitespace character' })
  name: string;
}

export class BeginAdminActivationDto {
  @ApiProperty({ description: 'One-time token issued by an administrator' })
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  @MaxLength(TOKEN_MAX_LENGTH)
  activationToken: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/\S/u, {
    message: 'password must contain a non-whitespace character',
  })
  password: string;
}

export class VerifyAdminActivationDto {
  @ApiProperty({ description: 'Short-lived enrollment challenge token' })
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  @MaxLength(TOKEN_MAX_LENGTH)
  challengeToken: string;

  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @Matches(/^\d{6}$/u)
  code: string;
}

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class VerifyAdminMfaDto {
  @ApiProperty({ description: 'Short-lived login challenge token' })
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  @MaxLength(TOKEN_MAX_LENGTH)
  challengeToken: string;

  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @Matches(/^\d{6}$/u)
  code: string;
}

export class AdminRefreshDto {
  @ApiProperty({ description: 'Rotating Admin refresh token' })
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  @MaxLength(TOKEN_MAX_LENGTH)
  refreshToken: string;
}

export class AdminProvisioningResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ description: 'Shown once; deliver through a secure channel' })
  activationToken: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
}

export class AdminActivationResponseDto {
  @ApiProperty({ description: 'Short-lived enrollment challenge token' })
  challengeToken: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({ description: 'Base32 TOTP seed shown only during enrollment' })
  secret: string;

  @ApiProperty({ description: 'Authenticator-app provisioning URI' })
  otpauthUri: string;
}

export class AdminMfaChallengeResponseDto {
  @ApiProperty({ description: 'Short-lived MFA challenge token' })
  challengeToken: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
}

export class AdminSessionResponseDto {
  @ApiProperty({ description: 'Short-lived bearer access token' })
  accessToken: string;

  @ApiProperty({ format: 'date-time' })
  accessTokenExpiresAt: Date;

  @ApiProperty({ description: 'Rotating refresh token' })
  refreshToken: string;

  @ApiProperty({ format: 'date-time' })
  sessionExpiresAt: Date;
}

export class AdminAccountRoleResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String] })
  permissions: string[];
}

export class AdminAccountSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ enum: AccountStatus })
  status: AccountStatus;

  @ApiProperty()
  mfaEnrolled: boolean;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lockedUntil: Date | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastSeenAt: Date | null;

  @ApiProperty({ type: [AdminAccountRoleResponseDto] })
  roles: AdminAccountRoleResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class AdminAccountPageQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: AccountStatus })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

export class AdminAccountPageResponseDto {
  @ApiProperty({ type: [AdminAccountSummaryResponseDto] })
  items: AdminAccountSummaryResponseDto[];

  @ApiProperty({ minimum: 0 })
  total: number;

  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize: number;

  @ApiProperty({ minimum: 0 })
  pageCount: number;
}

export class UpdateAdminAccountStatusDto {
  @ApiProperty({
    enum: [AccountStatus.ACTIVE, AccountStatus.SUSPENDED, AccountStatus.DEACTIVATED],
  })
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
