/** Objetivo: endpoints del catálogo de tipos y búsqueda de equipos por serie. */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InvalidInputError } from '../../common/errors/domain.errors';
import { EquipmentResponseDto, EquipmentTypeResponseDto } from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';

@ApiTags('equipment')
@ApiBearerAuth()
@Controller()
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get('equipment-types')
  listTypes(): Promise<EquipmentTypeResponseDto[]> {
    return this.equipmentService.listTypes();
  }

  @Get('equipments')
  @ApiQuery({ name: 'serial', required: true })
  findBySerial(@Query('serial') serial?: string): Promise<EquipmentResponseDto[]> {
    if (!serial || serial.trim().length < 2) {
      throw new InvalidInputError('Indique al menos 2 caracteres del número de serie');
    }
    return this.equipmentService.findBySerial(serial.trim());
  }
}
