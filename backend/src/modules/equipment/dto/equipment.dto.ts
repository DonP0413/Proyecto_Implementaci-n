/** Objetivo: DTOs de equipos y tipos de equipo. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';
import type { EquipmentTypeEntity, SpecField } from '../equipment-type.entity';
import type { EquipmentEntity } from '../equipment.entity';

const trim = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

export class EquipmentInputDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  equipmentTypeId: number;

  @ApiProperty({ example: 'HP' })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  brand: string;

  @ApiProperty({ example: 'Pavilion 15-eg0xxx' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  model: string;

  @ApiProperty({ example: '5CD1234XYZ', description: 'Número de serie del equipo (obligatorio)' })
  @Transform(trim)
  @IsString({ message: 'El número de serie es obligatorio' })
  @Length(1, 80, { message: 'El número de serie debe tener entre 1 y 80 caracteres' })
  serialNumber: string;

  @ApiPropertyOptional({ example: { ram: '16 GB', storage: '512 GB SSD' } })
  @IsOptional()
  @IsObject()
  technicalSpecs?: Record<string, string | number>;

  @ApiPropertyOptional({
    description:
      'Si es true, registra una unidad física independiente aunque exista otro equipo con la misma serie (ej. error de fábrica o reacondicionado).',
  })
  @IsOptional()
  @IsBoolean()
  forceNewEquipment?: boolean;
}

export class EquipmentTypeResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() specSchema: SpecField[];

  static from(entity: EquipmentTypeEntity): EquipmentTypeResponseDto {
    return { id: entity.id, code: entity.code, name: entity.name, specSchema: entity.specSchema };
  }
}

export class EquipmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() clientId: string;
  @ApiPropertyOptional() client?: { id: string; fullName: string; documentId: string | null };
  @ApiProperty() equipmentType: { id: number; code: string; name: string };
  @ApiProperty() brand: string;
  @ApiProperty() model: string;
  @ApiPropertyOptional({ type: String, nullable: true }) serialNumber: string | null;
  @ApiProperty() technicalSpecs: Record<string, string>;

  static from(entity: EquipmentEntity): EquipmentResponseDto {
    return {
      id: entity.id,
      clientId: entity.clientId,
      client: entity.client
        ? {
            id: entity.client.id,
            fullName: entity.client.fullName,
            documentId: entity.client.documentId,
          }
        : undefined,
      equipmentType: {
        id: entity.equipmentType?.id ?? entity.equipmentTypeId,
        code: entity.equipmentType?.code ?? '',
        name: entity.equipmentType?.name ?? '',
      },
      brand: entity.brand,
      model: entity.model,
      serialNumber: entity.serialNumber,
      technicalSpecs: entity.technicalSpecs,
    };
  }
}
