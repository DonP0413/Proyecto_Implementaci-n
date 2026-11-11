/** Objetivo: ensamblar el módulo de equipos. */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentTypeEntity } from './equipment-type.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentEntity } from './equipment.entity';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentEntity, EquipmentTypeEntity])],
  controllers: [EquipmentController],
  providers: [EquipmentService, EquipmentRepository],
  exports: [EquipmentService],
})
export class EquipmentModule {}
