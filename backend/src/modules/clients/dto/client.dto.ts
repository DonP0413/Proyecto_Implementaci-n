/** Objetivo: DTOs del módulo de clientes. */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination';
import {
  CLIENT_NAME_MESSAGE,
  CLIENT_NAME_RULE,
  DOCUMENT_ID_MESSAGE,
  DOCUMENT_ID_RULE,
  PHONE_MESSAGE,
  PHONE_RULE,
} from '../../../common/validation/field-rules';
import type { ClientEntity } from '../client.entity';

const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreateClientDto {
  @ApiProperty({ example: 'María Fernanda Pérez' })
  @Transform(trimOrNull)
  @IsString()
  @Length(3, 150)
  @Matches(CLIENT_NAME_RULE, { message: CLIENT_NAME_MESSAGE })
  fullName: string;

  @ApiProperty({
    example: '1718123456',
    description: 'Cédula (10 dígitos) o RUC (13 dígitos), sólo números (obligatorio)',
  })
  @Transform(trimOrNull)
  @IsString({ message: 'La cédula / RUC del cliente es obligatoria' })
  @Matches(DOCUMENT_ID_RULE, { message: DOCUMENT_ID_MESSAGE })
  documentId: string;

  @ApiProperty({ example: 'maria.perez@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'El correo del cliente no es válido' })
  @MaxLength(160)
  email: string;

  @ApiPropertyOptional({ example: '0991234567' })
  @IsOptional()
  @Transform(trimOrNull)
  @MaxLength(20)
  @Matches(PHONE_RULE, { message: PHONE_MESSAGE })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional({
    example: '2026-11-09',
    description:
      'Fecha de ingreso del cliente (YYYY-MM-DD). Si se omite, se usa la fecha de hoy. No puede ser futura.',
  })
  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de ingreso debe tener el formato AAAA-MM-DD' })
  @IsDateString({ strict: true }, { message: 'La fecha de ingreso no es válida' })
  registeredAt?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class ClientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nombre, correo, documento o teléfono' })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ClientResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiPropertyOptional({ type: String, nullable: true }) documentId: string | null;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ type: String, nullable: true }) phone: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) address: string | null;
  @ApiProperty({ example: '2026-11-09', description: 'Fecha de ingreso del cliente' }) registeredAt: string;
  @ApiProperty() createdAt: string;

  static from(entity: ClientEntity): ClientResponseDto {
    return {
      id: entity.id,
      fullName: entity.fullName,
      documentId: entity.documentId,
      email: entity.email,
      phone: entity.phone,
      address: entity.address,
      registeredAt: entity.registeredAt,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
