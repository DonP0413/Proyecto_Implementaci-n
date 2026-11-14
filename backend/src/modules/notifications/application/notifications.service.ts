/**
 * Objetivo: fachada (Facade) del módulo de notificaciones para el resto del
 * sistema. Otros módulos SÓLO usan este servicio para:
 *  - enqueue(): registrar un correo en el outbox dentro de SU transacción.
 *  - signalEnqueued(): avisar (Observer) al worker tras el commit para envío inmediato.
 *  - consultar y reintentar notificaciones.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { EntityManager } from 'typeorm';
import { BusinessRuleError, NotFoundError } from '../../../common/errors/domain.errors';
import {
  NOTIFICATION_ENQUEUED_EVENT,
  NOTIFICATION_LABELS,
  NOTIFICATION_TEMPLATES,
  NotificationPayload,
  NotificationStatus,
  NotificationTrigger,
  NotificationType,
} from '../domain/notification.enums';
import { NotificationEntity } from '../infrastructure/notification.entity';
import { NotificationsRepository } from '../infrastructure/notifications.repository';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationPreviewDto, NotificationResponseDto } from './notification.dto';
import { TemplateRendererService } from './template-renderer.service';

export interface EnqueueNotificationInput {
  workOrderId: string;
  type: NotificationType;
  trigger: NotificationTrigger;
  recipientEmail: string;
  subject: string;
  payload: NotificationPayload;
  requestedBy?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly renderer: TemplateRendererService,
  ) {}

  async enqueue(input: EnqueueNotificationInput, manager: EntityManager): Promise<NotificationEntity> {
    const entity = this.notifications.create(
      {
        workOrderId: input.workOrderId,
        type: input.type,
        trigger: input.trigger,
        template: NOTIFICATION_TEMPLATES[input.type],
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        payload: input.payload,
        status: NotificationStatus.PENDING,
        attempts: 0,
        maxAttempts: this.config.get<number>('notifications.maxAttempts') ?? 5,
        nextAttemptAt: new Date(),
        requestedBy: input.requestedBy ?? null,
      },
      manager,
    );
    return this.notifications.save(entity, manager);
  }

  hasActive(workOrderId: string, type: NotificationType, manager?: EntityManager): Promise<boolean> {
    return this.notifications.hasActive(workOrderId, type, manager);
  }

  /** Debe llamarse DESPUÉS del commit de la transacción que encoló el correo. */
  signalEnqueued(): void {
    this.events.emit(NOTIFICATION_ENQUEUED_EVENT);
  }

  async listByWorkOrder(workOrderId: string): Promise<NotificationResponseDto[]> {
    return (await this.notifications.listByWorkOrder(workOrderId)).map(NotificationResponseDto.from);
  }

  async listByStatus(status: NotificationStatus): Promise<NotificationResponseDto[]> {
    return (await this.notifications.listByStatus(status)).map(NotificationResponseDto.from);
  }

  async preview(id: string): Promise<NotificationPreviewDto> {
    const notification = await this.notifications.findById(id);
    if (!notification) throw new NotFoundError('Notificación', id);
    const { html, text } = this.renderer.render(notification.template, notification.payload.data);
    return {
      id: notification.id,
      subject: notification.subject,
      recipientEmail: notification.recipientEmail,
      typeLabel: NOTIFICATION_LABELS[notification.type],
      status: notification.status,
      html,
      text,
    };
  }

  async syncRecipientForClient(
    clientId: string,
    recipientEmail: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.notifications.updateFailedRecipientsByClient(clientId, recipientEmail, manager);
  }

  async retry(id: string, recipientEmail?: string): Promise<NotificationResponseDto> {
    const notification = await this.notifications.findById(id);
    if (!notification) throw new NotFoundError('Notificación', id);
    if (notification.status !== NotificationStatus.FAILED) {
      throw new BusinessRuleError(
        'Sólo se pueden reintentar notificaciones fallidas',
        'NOTIFICATION_NOT_FAILED',
      );
    }
    let nextEmail = recipientEmail?.trim();
    if (nextEmail) {
      await this.notifications.updateClientEmailByWorkOrderId(notification.workOrderId, nextEmail);
    } else {
      const client = await this.notifications.findClientByWorkOrderId(notification.workOrderId);
      if (client?.email) nextEmail = client.email;
    }
    await this.notifications.resetForManualRetry(id, nextEmail);
    await this.dispatcher.deliverById(id);
    const updated = await this.notifications.findById(id);
    return NotificationResponseDto.from(updated!);
  }
}
