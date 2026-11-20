/** Objetivo: DTOs de autenticación. */
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { UserResponseDto } from '../../users/dto/user.dto';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Nombre de usuario' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  username: string;

  @ApiProperty({ example: 'Cambiar2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: '8h' }) expiresIn: string;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}
