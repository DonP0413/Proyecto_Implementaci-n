/**
 * Objetivo: mapeo ORM del AGREGADO RAÍZ (DDD) `work_orders`. Todas las
 * entidades hijas (recepción, accesorios, cotizaciones, registro técnico,
 * entrega, adjuntos, historial) se modifican sólo a través de los casos de
 * uso de este agregado.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ClientEntity } from '../../../clients/client.entity';
import { EquipmentEntity } from '../../../equipment/equipment.entity';
import { UserEntity } from '../../../users/user.entity';
import { WorkOrderStatus } from '../../domain/work-order-status';
import { AttachmentEntity } from './attachment.entity';
import { DeliveryRecordEntity } from './delivery-record.entity';
import { QuotationEntity } from './quotation.entity';
import { ReceptionConditionEntity } from './reception-condition.entity';
import { StatusHistoryEntity } from './status-history.entity';
import { TechnicalLogEntity } from './technical-log.entity';
import { WorkOrderAccessoryEntity } from './work-order-accessory.entity';

@Entity({ name: 'work_orders' })
export class WorkOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client: Relation<ClientEntity>;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId: string;

  @ManyToOne(() => EquipmentEntity, { nullable: false })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Relation<EquipmentEntity>;

  @Column({ type: 'varchar', length: 30, default: WorkOrderStatus.INGRESADO })
  status: WorkOrderStatus;

  @Column({ name: 'reported_issue', type: 'text' })
  reportedIssue: string;

  @Column({ name: 'specs_snapshot', type: 'jsonb' })
  specsSnapshot: Record<string, string>;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'received_by', type: 'uuid' })
  receivedById: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'received_by' })
  receivedBy: Relation<UserEntity>;

  @Column({ name: 'assigned_technician_id', type: 'uuid', nullable: true })
  assignedTechnicianId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'assigned_technician_id' })
  assignedTechnician: Relation<UserEntity> | null;

  @Column({ name: 'estimated_delivery_date', type: 'date', nullable: true })
  estimatedDeliveryDate: string | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => ReceptionConditionEntity, (rc) => rc.workOrder)
  receptionCondition?: Relation<ReceptionConditionEntity>;

  @OneToMany(() => WorkOrderAccessoryEntity, (a) => a.workOrder)
  accessories?: Relation<WorkOrderAccessoryEntity>[];

  @OneToMany(() => QuotationEntity, (q) => q.workOrder)
  quotations?: Relation<QuotationEntity>[];

  @OneToMany(() => TechnicalLogEntity, (t) => t.workOrder)
  technicalLogs?: Relation<TechnicalLogEntity>[];

  @OneToOne(() => DeliveryRecordEntity, (d) => d.workOrder)
  deliveryRecord?: Relation<DeliveryRecordEntity>;

  @OneToMany(() => AttachmentEntity, (a) => a.workOrder)
  attachments?: Relation<AttachmentEntity>[];

  @OneToMany(() => StatusHistoryEntity, (h) => h.workOrder)
  statusHistory?: Relation<StatusHistoryEntity>[];
}
