/** Objetivo: mapeo ORM de `delivery_records` (información visible al cliente en la entrega). */
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, Relation } from 'typeorm';
import { numericTransformer } from '../../../../common/database/transformers';
import { UserEntity } from '../../../users/user.entity';
import { WorkOrderEntity } from './work-order.entity';

@Entity({ name: 'delivery_records' })
export class DeliveryRecordEntity {
  @PrimaryColumn({ name: 'work_order_id', type: 'uuid' })
  workOrderId: string;

  @OneToOne(() => WorkOrderEntity, (wo) => wo.deliveryRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: Relation<WorkOrderEntity>;

  @Column({ name: 'work_summary', type: 'text' })
  workSummary: string;

  @Column({
    name: 'amount_charged',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  amountCharged: number;

  @Column({ name: 'return_condition', type: 'text' })
  returnCondition: string;

  @Column({ name: 'accessories_notes', type: 'varchar', length: 500, nullable: true })
  accessoriesNotes: string | null;

  @Column({ name: 'received_by_name', type: 'varchar', length: 150 })
  receivedByName: string;

  @Column({ name: 'received_by_document', type: 'varchar', length: 20, nullable: true })
  receivedByDocument: string | null;

  @Column({ name: 'delivered_by', type: 'uuid' })
  deliveredById: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'delivered_by' })
  deliveredBy: Relation<UserEntity>;

  @Column({ name: 'delivered_at', type: 'timestamptz' })
  deliveredAt: Date;
}
