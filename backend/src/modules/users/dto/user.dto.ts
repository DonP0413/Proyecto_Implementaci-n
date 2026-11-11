/** Objetivo: DTOs de entrada/salida del módulo de usuarios con validación declarativa. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { UserRole } from '../domain/user-role.enum';
import type { UserEntity } from '../user.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE = 'La contraseña debe tener entre 8 y 72 caracteres e incluir letras y números';

export class CreateUserDto {
  @ApiProperty({ example: 'Ana Torres' })
  @Transform(trim)
  @IsString()
  @Length(3, 120)
  fullName: string;

  @ApiProperty({ example: 'ana@pintotech.ec' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Clave2026' })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 120)
  fullName?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) lastLoginAt: string | null;
  @ApiProperty() createdAt: string;

  static from(entity: UserEntity): UserResponseDto {
    return {
      id: entity.id,
      fullName: entity.fullName,
      email: entity.email,
      role: entity.role,
      isActive: entity.isActive,
      lastLoginAt: entity.lastLoginAt ? entity.lastLoginAt.toISOString() : null,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
