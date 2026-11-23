/** Objetivo: mapeo ORM de `technical_logs` (registro interno del técnico). */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { UserEntity } from '../../../users/user.entity';
import { WorkOrderEntity } from './work-order.entity';

@Entity({ name: 'technical_logs' })
export class TechnicalLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_order_id', type: 'varchar', length: 36 })
  workOrderId: string;

  @ManyToOne(() => WorkOrderEntity, (wo) => wo.technicalLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: Relation<WorkOrderEntity>;

  @Column({ name: 'author_id', type: 'varchar', length: 36 })
  authorId: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'author_id' })
  author: Relation<UserEntity>;

  @Column({ type: 'text', nullable: true })
  diagnosis: string | null;

  @Column({ type: 'text', nullable: true })
  procedures: string | null;

  @Column({ type: 'text', nullable: true })
  configurations: string | null;

  @Column({ name: 'spare_parts', type: 'text', nullable: true })
  spareParts: string | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
