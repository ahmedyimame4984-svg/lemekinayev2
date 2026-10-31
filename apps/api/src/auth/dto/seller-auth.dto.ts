import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const TOKEN_MIN_LENGTH = 40;
const TOKEN_MAX_LENGTH = 100;

export class ProvisionSellerAccountDto {
  @ApiProperty({ example: 'Abebe Automotive PLC' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/u, { message: 'name must contain a non-whitespace character' })
  name!: string;

  @ApiProperty({ example: '+251911223344' })
  @Matches(/^\+[1-9]\d{7,14}$/u, {
    message: 'phone must be in E.164 format',
  })
  phone!: string;

  @ApiPropertyOptional({ example: 'seller@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  sellerCode!: string;

  @ApiProperty({ minLength: 2, maxLength: 180 })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  businessName!: string;

  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @ApiProperty({ enum: SellerType })
  @IsEnum(SellerType)
  sellerType!: SellerType;
}

export class SellerProvisioningResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  sellerId!: string;

  @ApiProperty({ description: 'Shown once; deliver through a secure channel' })
  activationToken!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

export class ActivateSellerAccountDto {
  @ApiProperty({ description: 'One-time Seller activation token' })
  @IsString()
  @MinLength(TOKEN_MIN_LENGTH)
  @MaxLength(TOKEN_MAX_LENGTH)
  activationToken!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/\S/u, {
    message: 'password must contain a non-whitespace character',
  })
  password!: string;
}

export class SellerLoginDto {
  @ApiProperty({
    description: 'Registered Seller email or E.164 phone number',
    example: '+251911223344',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier!: string;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class SellerSessionResponseDto {
  @ApiProperty({ description: 'Bearer access token' })
  accessToken!: string;

  @ApiProperty({ format: 'date-time' })
  accessTokenExpiresAt!: Date;
}
