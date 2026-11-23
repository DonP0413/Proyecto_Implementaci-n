/** Objetivo: mapeo ORM de `status_history` (auditoría de estados). */
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { UserEntity } from '../../../users/user.entity';
import { WorkOrderStatus } from '../../domain/work-order-status';
import { WorkOrderEntity } from './work-order.entity';

@Entity({ name: 'status_history' })
export class StatusHistoryEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'work_order_id', type: 'varchar', length: 36 })
  workOrderId: string;

  @ManyToOne(() => WorkOrderEntity, (wo) => wo.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: Relation<WorkOrderEntity>;

  @Column({ name: 'from_status', type: 'varchar', length: 30, nullable: true })
  fromStatus: WorkOrderStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 30 })
  toStatus: WorkOrderStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 36, nullable: true })
  changedById: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedBy: Relation<UserEntity> | null;

  @Column({ name: 'changed_at', type: 'datetime', default: () => "(strftime('%Y-%m-%d %H:%M:%f', 'now'))" })
  changedAt: Date;
}
