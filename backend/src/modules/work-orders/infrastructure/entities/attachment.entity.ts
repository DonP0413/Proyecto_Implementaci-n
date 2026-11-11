/** Objetivo: mapeo ORM de `attachments` (fotos, documentos técnicos y comprobantes). */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { AttachmentCategory, AttachmentVisibility } from '../../domain/work-order.enums';
import { WorkOrderEntity } from './work-order.entity';

@Entity({ name: 'attachments' })
export class AttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_order_id', type: 'uuid' })
  workOrderId: string;

  @ManyToOne(() => WorkOrderEntity, (wo) => wo.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: Relation<WorkOrderEntity>;

  @Column({ name: 'technical_log_id', type: 'uuid', nullable: true })
  technicalLogId: string | null;

  @Column({ type: 'varchar', length: 30 })
  category: AttachmentCategory;

  @Column({ type: 'varchar', length: 10 })
  visibility: AttachmentVisibility;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 300 })
  storageKey: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
