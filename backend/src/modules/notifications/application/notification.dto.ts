/** Objetivo: DTO de salida de notificaciones y entrada de reintento. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';
import {
  NOTIFICATION_LABELS,
  NotificationStatus,
  NotificationTrigger,
  NotificationType,
} from '../domain/notification.enums';
import type { NotificationEntity } from '../infrastructure/notification.entity';

export class RetryNotificationDto {
  @ApiPropertyOptional({
    description: 'Nuevo correo destinatario (opcional). Si se indica, actualiza la ficha del cliente.',
    example: 'cliente.autorizado@gmail.com',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido para reintentar' })
  @MaxLength(160)
  recipientEmail?: string;
}

export class NotificationPreviewDto {
  @ApiProperty() id: string;
  @ApiProperty() subject: string;
  @ApiProperty() recipientEmail: string;
  @ApiProperty() typeLabel: string;
  @ApiProperty({ enum: NotificationStatus }) status: NotificationStatus;
  @ApiProperty() html: string;
  @ApiProperty() text: string;
}

export class NotificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() workOrderId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) workOrderCode: string | null;
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
    const payloadData = entity.payload?.data as { workOrder?: { code?: string } } | undefined;
    return {
      id: entity.id,
      workOrderId: entity.workOrderId,
      workOrderCode: payloadData?.workOrder?.code ?? null,
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
