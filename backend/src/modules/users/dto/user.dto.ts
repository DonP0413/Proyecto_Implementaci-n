/** Objetivo: DTOs de entrada/salida del módulo de usuarios con validación declarativa. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { UserRole } from '../domain/user-role.enum';
import { PERSON_NAME_MESSAGE, PERSON_NAME_RULE } from '../../../common/validation/field-rules';
import type { UserEntity } from '../user.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE = 'La contraseña debe tener entre 8 y 72 caracteres e incluir letras y números';
/**
 * Nombre de usuario para iniciar sesión (la app es local: no hace falta un correo).
 * Se admiten '@', '.', '_' y '-' para que los usuarios antiguos con formato de
 * correo sigan siendo válidos.
 */
export const USERNAME_RULE = /^[a-z0-9._@-]{3,60}$/;
export const USERNAME_MESSAGE =
  'El usuario debe tener entre 3 y 60 caracteres: letras, números, punto, guion o guion bajo, sin espacios';

export class CreateUserDto {
  @ApiProperty({ example: 'Ana Torres' })
  @Transform(trim)
  @IsString()
  @Length(3, 120)
  @Matches(PERSON_NAME_RULE, { message: PERSON_NAME_MESSAGE })
  fullName: string;

  @ApiProperty({ example: 'ana.torres', description: 'Nombre de usuario para iniciar sesión' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(USERNAME_RULE, { message: USERNAME_MESSAGE })
  username: string;

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
  @Matches(PERSON_NAME_RULE, { message: PERSON_NAME_MESSAGE })
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
  @ApiProperty() username: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) lastLoginAt: string | null;
  @ApiProperty() createdAt: string;

  static from(entity: UserEntity): UserResponseDto {
    return {
      id: entity.id,
      fullName: entity.fullName,
      username: entity.username,
      role: entity.role,
      isActive: entity.isActive,
      lastLoginAt: entity.lastLoginAt ? entity.lastLoginAt.toISOString() : null,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
