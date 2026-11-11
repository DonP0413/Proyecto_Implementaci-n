/** Objetivo: mapeo ORM de `quotations`. */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { numericTransformer } from '../../../../common/database/transformers';
import { UserEntity } from '../../../users/user.entity';
import { WorkOrderEntity } from './work-order.entity';

@Entity({ name: 'quotations' })
export class QuotationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_order_id', type: 'uuid' })
  workOrderId: string;

  @ManyToOne(() => WorkOrderEntity, (wo) => wo.quotations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: Relation<WorkOrderEntity>;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'estimated_days', type: 'smallint', nullable: true })
  estimatedDays: number | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  createdBy: Relation<UserEntity>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;
}
