/**
 * Objetivo: worker que procesa la cola outbox y envía los correos.
 *  - Se despierta cada NOTIFICATIONS_POLL_INTERVAL_MS y también de inmediato
 *    cuando se encola un correo (Observer vía EventEmitter).
 *  - Reclama lotes con SKIP LOCKED (seguro con varias réplicas).
 *  - Reintenta errores transitorios con backoff exponencial (Strategy).
 *  - Marca FAILED los errores permanentes o al agotar intentos; el personal
 *    puede reintentar manualmente desde la UI.
 *  - Registra logs estructurados y métricas por cada envío.
 */
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { MAIL_SENDER, MailDeliveryError, MailSender } from '../../../infrastructure/mail/mail-sender.port';
import { FILE_STORAGE, FileStorage } from '../../../infrastructure/storage/file-storage.port';
import { MetricsService } from '../../metrics/metrics.service';
import { NOTIFICATION_ENQUEUED_EVENT } from '../domain/notification.enums';
import { RETRY_POLICY, RetryPolicy } from '../domain/retry-policy';
import type { NotificationEntity } from '../infrastructure/notification.entity';
import { NotificationsRepository } from '../infrastructure/notifications.repository';
import { EmailMessageBuilder } from './email-message.builder';
import { TemplateRendererService } from './template-renderer.service';

@Injectable()
export class NotificationDispatcherService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private rerunRequested = false;

  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly renderer: TemplateRendererService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(RETRY_POLICY) private readonly retryPolicy: RetryPolicy,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get<boolean>('notifications.workerEnabled')) {
      this.logger.warn('Worker de notificaciones deshabilitado (NOTIFICATIONS_WORKER_ENABLED=false)');
      return;
    }
    const interval = this.config.get<number>('notifications.pollIntervalMs') ?? 15000;
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
    this.logger.log({ interval, provider: this.mailSender.provider }, 'Worker de notificaciones iniciado');
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  @OnEvent(NOTIFICATION_ENQUEUED_EVENT, { async: true })
  async handleEnqueued(): Promise<void> {
    if (!this.config.get<boolean>('notifications.workerEnabled')) return;
    await this.tick();
  }

  /** Procesa la cola hasta vaciar lo vencido. Nunca se ejecutan dos ticks simultáneos. */
  async tick(): Promise<void> {
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.rerunRequested = false;
        await this.notifications.releaseStuck(
          this.config.get<number>('notifications.stuckAfterMinutes') ?? 10,
        );
        const batchSize = this.config.get<number>('notifications.batchSize') ?? 10;
        let batch = await this.notifications.claimBatch(batchSize);
        while (batch.length > 0) {
          for (const notification of batch) await this.deliver(notification);
          batch = batch.length === batchSize ? await this.notifications.claimBatch(batchSize) : [];
        }
      } while (this.rerunRequested);
      this.metrics.notificationsPending.set(await this.notifications.countPending());
    } catch (error) {
      this.logger.error({ err: error }, 'Error procesando la cola de notificaciones');
    } finally {
      this.running = false;
    }
  }

  async deliver(notification: NotificationEntity): Promise<void> {
    const context = {
      notificationId: notification.id,
      workOrderId: notification.workOrderId,
      type: notification.type,
      attempt: notification.attempts,
    };
    try {
      const { html, text } = this.renderer.render(notification.template, notification.payload.data);
      const builder = new EmailMessageBuilder()
        .to(notification.recipientEmail)
        .subject(notification.subject)
        .content(html, text)
        .tag(notification.type.toLowerCase())
        .tag(notification.trigger.toLowerCase())
        .variable('notification_id', notification.id)
        .variable('work_order_id', notification.workOrderId);

      for (const ref of notification.payload.attachments ?? []) {
        try {
          const content = await this.storage.read(ref.storageKey);
          builder.attach({ filename: ref.filename, content, contentType: ref.mimeType });
        } catch (error) {
          this.logger.warn(
            { ...context, storageKey: ref.storageKey, err: error },
            'Adjunto no disponible; se omite',
          );
        }
      }
      if (builder.skippedAttachments.length) {
        this.logger.warn({ ...context, skipped: builder.skippedAttachments }, 'Adjuntos omitidos por tamaño');
      }

      const result = await this.mailSender.send(builder.build());
      await this.notifications.markSent(notification.id, result.messageId);
      this.metrics.notificationsProcessed.inc({ type: notification.type, result: 'sent' });
      this.logger.log({ ...context, messageId: result.messageId }, 'Notificación enviada');
    } catch (error) {
      await this.handleFailure(notification, error, context);
    }
  }

  private async handleFailure(
    notification: NotificationEntity,
    error: unknown,
    context: Record<string, unknown>,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    // Errores de Mailgun traen su clasificación; cualquier otro (BD, disco, red) se considera transitorio
    // y se reintenta hasta agotar max_attempts.
    const permanent = error instanceof MailDeliveryError && error.permanent;
    const exhausted = notification.attempts >= notification.maxAttempts;

    if (permanent || exhausted) {
      await this.notifications.markFailed(notification.id, message);
      this.metrics.notificationsProcessed.inc({ type: notification.type, result: 'failed' });
      this.logger.error({ ...context, permanent, exhausted, error: message }, 'Notificación FALLIDA');
      return;
    }
    const delayMs = this.retryPolicy.nextDelayMs(notification.attempts);
    await this.notifications.scheduleRetry(notification.id, message, new Date(Date.now() + delayMs));
    this.metrics.notificationsProcessed.inc({ type: notification.type, result: 'retry' });
    this.logger.warn({ ...context, delayMs, error: message }, 'Notificación reprogramada para reintento');
  }
}
