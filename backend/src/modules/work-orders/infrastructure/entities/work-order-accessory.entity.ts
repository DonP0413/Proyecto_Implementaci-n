/** Objetivo: mapeo ORM de `work_order_accessories`. */
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { WorkOrderEntity } from './work-order.entity';

@Entity({ name: 'work_order_accessories' })
export class WorkOrderAccessoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_order_id', type: 'varchar', length: 36 })
  workOrderId: string;

  @ManyToOne(() => WorkOrderEntity, (wo) => wo.accessories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: Relation<WorkOrderEntity>;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'smallint', default: 1 })
  quantity: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: false })
  returned: boolean;
}
