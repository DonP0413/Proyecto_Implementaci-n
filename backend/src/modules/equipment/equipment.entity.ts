/** Objetivo: mapeo ORM de `equipments` (equipo físico de un cliente). */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ClientEntity } from '../clients/client.entity';
import { EquipmentTypeEntity } from './equipment-type.entity';

@Entity({ name: 'equipments' })
export class EquipmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  clientId: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client: Relation<ClientEntity>;

  @Column({ name: 'equipment_type_id', type: 'smallint' })
  equipmentTypeId: number;

  @ManyToOne(() => EquipmentTypeEntity, { nullable: false })
  @JoinColumn({ name: 'equipment_type_id' })
  equipmentType: Relation<EquipmentTypeEntity>;

  @Column({ type: 'varchar', length: 60 })
  brand: string;

  @Column({ type: 'varchar', length: 80 })
  model: string;

  @Column({ name: 'serial_number', type: 'varchar', length: 80, nullable: true })
  serialNumber: string | null;

  @Column({ name: 'technical_specs', type: 'simple-json', default: '{}' })
  technicalSpecs: Record<string, string>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
