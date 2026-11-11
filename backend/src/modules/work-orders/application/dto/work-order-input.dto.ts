/**
 * Objetivo: DTOs de ENTRADA de los casos de uso de órdenes de trabajo.
 * Validación declarativa con class-validator (los mensajes llegan al frontend).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination';
import { CreateClientDto } from '../../../clients/dto/client.dto';
import { EquipmentInputDto } from '../../../equipment/dto/equipment.dto';
import { WorkOrderStatus } from '../../domain/work-order-status';
import { AttachmentCategory, PhysicalCondition, PowerStatus } from '../../domain/work-order.enums';

const trim = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

export class ReceptionConditionInputDto {
  @ApiProperty({ enum: PowerStatus })
  @IsEnum(PowerStatus)
  powerStatus: PowerStatus;

  @ApiProperty({ enum: PhysicalCondition })
  @IsEnum(PhysicalCondition)
  physicalCondition: PhysicalCondition;

  @ApiPropertyOptional({ example: 'Rayón en la tapa, bisagra izquierda floja' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  visibleDamage?: string;

  @ApiPropertyOptional({ example: 'Enciende pero no da imagen' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  functionalNotes?: string;
}

export class AccessoryInputDto {
  @ApiProperty({ example: 'Cargador original' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class CreateWorkOrderDto {
  @ApiPropertyOptional({ description: 'Cliente existente. Si se omite, se envía `client`.' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ type: CreateClientDto })
  @ValidateIf((o: CreateWorkOrderDto) => !o.clientId)
  @ValidateNested()
  @Type(() => CreateClientDto)
  client?: CreateClientDto;

  @ApiProperty({ type: EquipmentInputDto })
  @ValidateNested()
  @Type(() => EquipmentInputDto)
  equipment: EquipmentInputDto;

  @ApiProperty({ example: 'El equipo se apaga solo después de 10 minutos de uso' })
  @Transform(trim)
  @IsString()
  @Length(3, 2000)
  reportedIssue: string;

  @ApiProperty({ type: ReceptionConditionInputDto })
  @ValidateNested()
  @Type(() => ReceptionConditionInputDto)
  reception: ReceptionConditionInputDto;

  @ApiPropertyOptional({ type: [AccessoryInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AccessoryInputDto)
  accessories: AccessoryInputDto[] = [];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional()
  @IsDateString({ strict: true })
  estimatedDeliveryDate?: string;

  @ApiPropertyOptional({
    example: '2026-11-09T14:30:00.000Z',
    description:
      'Fecha y hora de ingreso del equipo (ISO 8601). Si se omite, es el momento del registro. No puede ser futura.',
  })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'La fecha de ingreso no es válida' })
  receivedAt?: string;
}

export class ChangeStatusDto {
  @ApiProperty({ enum: WorkOrderStatus })
  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;

  @ApiPropertyOptional({ example: 'Se inicia diagnóstico' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssignTechnicianDto {
  @ApiProperty({ nullable: true, type: String })
  @ValidateIf((_o, value) => value !== null)
  @IsUUID()
  technicianId: string | null;
}

export class CreateQuotationDto {
  @ApiProperty({ example: 85.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(99_999_999.99)
  amount: number;

  @ApiProperty({ example: 'Cambio de pantalla 15.6" FHD + mano de obra' })
  @Transform(trim)
  @IsString()
  @Length(3, 4000)
  description: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  estimatedDays?: number;
}

export class CreateTechnicalLogDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(10000) diagnosis?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(10000) procedures?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(10000) configurations?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(10000) spareParts?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(10000) observations?: string;
}

export class RegisterDeliveryDto {
  @ApiProperty({ example: 'Se reemplazó la pantalla y se realizó limpieza interna.' })
  @Transform(trim)
  @IsString()
  @Length(3, 4000)
  workSummary: string;

  @ApiProperty({ example: 85.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(99_999_999.99)
  amountCharged: number;

  @ApiProperty({ example: 'Equipo funcional, limpio, sin daños adicionales.' })
  @Transform(trim)
  @IsString()
  @Length(3, 4000)
  returnCondition: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  accessoriesNotes?: string;

  @ApiProperty({ example: 'María Fernanda Pérez' })
  @Transform(trim)
  @IsString()
  @Length(3, 150)
  receivedByName: string;

  @ApiPropertyOptional({ example: '1718123456' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  receivedByDocument?: string;

  @ApiPropertyOptional({ type: [String], description: 'IDs de accesorios devueltos al cliente' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  returnedAccessoryIds: string[] = [];
}

export const UPLOADABLE_CATEGORIES = [
  AttachmentCategory.RECEPTION_PHOTO,
  AttachmentCategory.DELIVERY_PHOTO,
  AttachmentCategory.TECHNICAL_DOCUMENT,
] as const;

export class UploadAttachmentDto {
  @ApiProperty({ enum: UPLOADABLE_CATEGORIES })
  @IsIn(UPLOADABLE_CATEGORIES)
  category: (typeof UPLOADABLE_CATEGORIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  technicalLogId?: string;
}

export class WorkOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general: código, cliente, correo, documento, serie o modelo',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'ID de trabajo (parcial)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  code?: string;

  @ApiPropertyOptional({ description: 'Nombre, correo o documento del cliente' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  client?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional({ description: 'Número de serie (parcial)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  serial?: string;

  @ApiPropertyOptional({
    enum: WorkOrderStatus,
    isArray: true,
    description: 'Uno o varios separados por coma',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsEnum(WorkOrderStatus, { each: true })
  status?: WorkOrderStatus[];

  @ApiPropertyOptional({ example: '2026-11-01' }) @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional({ example: '2026-11-30' }) @IsOptional() @IsDateString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() technicianId?: string;
}
