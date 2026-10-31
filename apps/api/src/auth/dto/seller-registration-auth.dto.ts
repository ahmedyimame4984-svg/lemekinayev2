import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterSellerAccountDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/\S/u, { message: 'Password must contain a non-space character' })
  password!: string;
}

export class VerifySellerEmailDto {
  @ApiProperty({ description: 'Single-use verification token' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/u)
  token!: string;
}

export class ResendSellerVerificationDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
