import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { CreateSellerApplicationDto } from './seller-registration.dto.js';

export class UpdateSellerApplicationDto extends CreateSellerApplicationDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ description: 'Required when changing the contact email' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/u)
  contactEmailCode?: string;
}
