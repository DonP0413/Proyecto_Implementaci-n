/** Objetivo: DTOs de autenticación. */
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DOWNLOADABLE_PATH } from '../../../common/auth/download-link';
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

export class DownloadTokenDto {
  @ApiProperty({
    example: '/work-orders/2f0c3c2e-0000-4000-8000-000000000000/receipt',
    description: 'Ruta del archivo (relativa a /api/v1): PDF de la orden o descarga de un adjunto',
  })
  @IsString()
  @Matches(DOWNLOADABLE_PATH, { message: 'Ruta de descarga no permitida' })
  path: string;
}

export class DownloadTokenResponseDto {
  @ApiProperty() token: string;
  @ApiProperty({ example: 120, description: 'Segundos de validez' }) expiresIn: number;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: '8h' }) expiresIn: string;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}
