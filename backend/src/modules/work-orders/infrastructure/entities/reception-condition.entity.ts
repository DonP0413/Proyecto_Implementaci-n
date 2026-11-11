/** Objetivo: mapeo ORM de `reception_conditions` (1:1 con la orden). */
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, Relation } from 'typeorm';
import { PhysicalCondition, PowerStatus } from '../../domain/work-order.enums';
import { WorkOrderEntity } from './work-order.entity';

@Entity({ name: 'reception_conditions' })
export class ReceptionConditionEntity {
  @PrimaryColumn({ name: 'work_order_id', type: 'uuid' })
  workOrderId: string;

  @OneToOne(() => WorkOrderEntity, (wo) => wo.receptionCondition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: Relation<WorkOrderEntity>;

  @Column({ name: 'power_status', type: 'varchar', length: 12 })
  powerStatus: PowerStatus;

  @Column({ name: 'physical_condition', type: 'varchar', length: 10 })
  physicalCondition: PhysicalCondition;

  @Column({ name: 'visible_damage', type: 'text', nullable: true })
  visibleDamage: string | null;

  @Column({ name: 'functional_notes', type: 'text', nullable: true })
  functionalNotes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
