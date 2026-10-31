import { ApiProperty } from '@nestjs/swagger';
import { SellerType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const phonePattern = /^\+?[0-9][0-9\s()-]{6,30}$/u;

export class CreateSellerApplicationDto {
  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  contactName!: string;

  // The account email is resolved from the authenticated principal, not this field.
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @Matches(phonePattern)
  @MaxLength(32)
  contactPhone!: string;

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

  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  businessEmail!: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @Matches(phonePattern)
  @MaxLength(32)
  businessPhone!: string;

  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  region!: string;

  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiProperty({ minLength: 4, maxLength: 500 })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  address!: string;

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  commercialRegistrationNumber!: string;

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tradeLicenseNumber!: string;

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tinNumber!: string;

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  vatRegistrationNumber!: string;

  @ApiProperty({ enum: ['true'] })
  @IsIn(['true'])
  termsAccepted!: string;
}

export class SellerApplicationSubmittedDto {
  @ApiProperty()
  referenceCode!: string;

  @ApiProperty({ format: 'date-time' })
  submittedAt!: Date;
}
