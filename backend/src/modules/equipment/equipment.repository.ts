/** Objetivo: Repository Pattern para equipos y catálogo de tipos. */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EquipmentTypeEntity } from './equipment-type.entity';
import { EquipmentEntity } from './equipment.entity';

@Injectable()
export class EquipmentRepository {
  constructor(
    @InjectRepository(EquipmentEntity) private readonly equipments: Repository<EquipmentEntity>,
    @InjectRepository(EquipmentTypeEntity) private readonly types: Repository<EquipmentTypeEntity>,
  ) {}

  listActiveTypes(): Promise<EquipmentTypeEntity[]> {
    return this.types.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  findTypeById(id: number, manager?: EntityManager): Promise<EquipmentTypeEntity | null> {
    const repo = manager ? manager.getRepository(EquipmentTypeEntity) : this.types;
    return repo.findOne({ where: { id } });
  }

  findById(id: string, manager: EntityManager): Promise<EquipmentEntity | null> {
    return manager.getRepository(EquipmentEntity).findOne({
      where: { id },
      relations: { equipmentType: true },
    });
  }

  findMatching(
    params: {
      clientId: string;
      equipmentTypeId: number;
      serialNumber: string;
      brand?: string;
      model?: string;
    },
    manager: EntityManager,
  ): Promise<EquipmentEntity | null> {
    return manager
      .getRepository(EquipmentEntity)
      .createQueryBuilder('e')
      .where('e.clientId = :clientId', { clientId: params.clientId })
      .andWhere('e.equipmentTypeId = :equipmentTypeId', { equipmentTypeId: params.equipmentTypeId })
      .andWhere('lower(e.serialNumber) = lower(:serial)', { serial: params.serialNumber })
      .orderBy('e.createdAt', 'DESC')
      .getOne();
  }

  save(equipment: EquipmentEntity, manager: EntityManager): Promise<EquipmentEntity> {
    return manager.getRepository(EquipmentEntity).save(equipment);
  }

  create(data: Partial<EquipmentEntity>, manager: EntityManager): EquipmentEntity {
    return manager.getRepository(EquipmentEntity).create(data);
  }

  findBySerial(serial: string): Promise<EquipmentEntity[]> {
    return this.equipments
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.equipmentType', 't')
      .leftJoinAndSelect('e.client', 'c')
      .where('lower(e.serialNumber) = lower(:serial)', { serial })
      .orderBy('e.createdAt', 'DESC')
      .getMany();
  }
}
