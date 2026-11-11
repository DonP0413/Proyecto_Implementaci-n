/** Objetivo: DTO de salida de notificaciones (sin exponer el payload completo). */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NOTIFICATION_LABELS,
  NotificationStatus,
  NotificationTrigger,
  NotificationType,
} from '../domain/notification.enums';
import type { NotificationEntity } from '../infrastructure/notification.entity';

export class NotificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() workOrderId: string;
  @ApiProperty({ enum: NotificationType }) type: NotificationType;
  @ApiProperty() typeLabel: string;
  @ApiProperty({ enum: NotificationTrigger }) trigger: NotificationTrigger;
  @ApiProperty() recipientEmail: string;
  @ApiProperty() subject: string;
  @ApiProperty({ enum: NotificationStatus }) status: NotificationStatus;
  @ApiProperty() attempts: number;
  @ApiProperty() maxAttempts: number;
  @ApiPropertyOptional({ type: String, nullable: true }) lastError: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) sentAt: string | null;
  @ApiProperty() nextAttemptAt: string;
  @ApiProperty() createdAt: string;

  static from(entity: NotificationEntity): NotificationResponseDto {
    return {
      id: entity.id,
      workOrderId: entity.workOrderId,
      type: entity.type,
      typeLabel: NOTIFICATION_LABELS[entity.type],
      trigger: entity.trigger,
      recipientEmail: entity.recipientEmail,
      subject: entity.subject,
      status: entity.status,
      attempts: entity.attempts,
      maxAttempts: entity.maxAttempts,
      lastError: entity.lastError,
      sentAt: entity.sentAt ? entity.sentAt.toISOString() : null,
      nextAttemptAt: entity.nextAttemptAt.toISOString(),
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
