import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class SellerApplicationAccessRequestDto {
  @ApiProperty({ example: 'SLR-APP-2026-ABCDEF123456' })
  @IsString()
  @Matches(/^SLR-APP-\d{4}-[A-Fa-f0-9]{12}$/u)
  referenceCode!: string;

  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(254)
  contactEmail!: string;
}

export class SellerApplicationAccessVerifyDto extends SellerApplicationAccessRequestDto {
  @ApiProperty({ minLength: 6, maxLength: 6 })
  @Matches(/^\d{6}$/u)
  code!: string;
}

export class SellerApplicationNewContactEmailDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(254)
  contactEmail!: string;
}
