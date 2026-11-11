/** Objetivo: mapeo ORM de la tabla outbox `notifications`. */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import {
  NotificationPayload,
  NotificationStatus,
  NotificationTrigger,
  NotificationType,
} from '../domain/notification.enums';

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_order_id', type: 'uuid' })
  workOrderId: string;

  @Column({ type: 'varchar', length: 30 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 10 })
  trigger: NotificationTrigger;

  @Column({ type: 'varchar', length: 50 })
  template: string;

  @Column({ name: 'recipient_email', type: 'varchar', length: 160 })
  recipientEmail: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'jsonb' })
  payload: NotificationPayload;

  @Column({ type: 'varchar', length: 10, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'smallint', default: 5 })
  maxAttempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz' })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 200, nullable: true })
  providerMessageId: string | null;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
