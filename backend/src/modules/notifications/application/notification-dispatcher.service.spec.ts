import { ConfigService } from '@nestjs/config';
import { MailDeliveryError, MailSender } from '../../../infrastructure/mail/mail-sender.port';
import { FileStorage } from '../../../infrastructure/storage/file-storage.port';
import { MetricsService } from '../../metrics/metrics.service';
import { NotificationStatus, NotificationTrigger, NotificationType } from '../domain/notification.enums';
import { RetryPolicy } from '../domain/retry-policy';
import type { NotificationEntity } from '../infrastructure/notification.entity';
import { NotificationsRepository } from '../infrastructure/notifications.repository';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { TemplateRendererService } from './template-renderer.service';

describe('NotificationDispatcherService.deliver', () => {
  const repo = { markSent: jest.fn(), markFailed: jest.fn(), scheduleRetry: jest.fn() };
  const renderer = { render: jest.fn().mockReturnValue({ html: '<p>hola</p>', text: 'hola' }) };
  const mail = { provider: 'test', send: jest.fn() };
  const storage = { read: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
  const retry: RetryPolicy = { nextDelayMs: () => 30_000 };
  const metrics = new MetricsService();

  const dispatcher = new NotificationDispatcherService(
    repo as unknown as NotificationsRepository,
    renderer as unknown as TemplateRendererService,
    { get: jest.fn() } as unknown as ConfigService,
    metrics,
    mail as unknown as MailSender,
    storage as unknown as FileStorage,
    retry,
  );

  const notification = (overrides: Partial<NotificationEntity> = {}): NotificationEntity =>
    ({
      id: 'n1',
      workOrderId: 'wo1',
      type: NotificationType.RECEPTION,
      trigger: NotificationTrigger.AUTOMATIC,
      template: 'reception',
      recipientEmail: 'cliente@example.com',
      subject: 'Recibimos su equipo',
      payload: {
        data: {},
        attachments: [{ storageKey: 'k', filename: 'c.pdf', mimeType: 'application/pdf' }],
      },
      status: NotificationStatus.SENDING,
      attempts: 1,
      maxAttempts: 5,
      ...overrides,
    }) as NotificationEntity;

  beforeEach(() => jest.clearAllMocks());

  it('marca como enviada cuando Mailgun acepta el mensaje', async () => {
    mail.send.mockResolvedValue({ provider: 'test', messageId: '<abc@mailgun>' });
    await dispatcher.deliver(notification());
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@example.com',
        attachments: [expect.objectContaining({ filename: 'c.pdf' })],
      }),
    );
    expect(repo.markSent).toHaveBeenCalledWith('n1', '<abc@mailgun>');
  });

  it('reprograma ante un error transitorio', async () => {
    mail.send.mockRejectedValue(new MailDeliveryError('503', false, 503));
    await dispatcher.deliver(notification());
    expect(repo.scheduleRetry).toHaveBeenCalledWith('n1', '503', expect.any(Date));
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('marca FAILED ante un error permanente', async () => {
    mail.send.mockRejectedValue(new MailDeliveryError('400 invalid to', true, 400));
    await dispatcher.deliver(notification());
    expect(repo.markFailed).toHaveBeenCalledWith('n1', '400 invalid to');
  });

  it('marca FAILED al agotar los intentos', async () => {
    mail.send.mockRejectedValue(new MailDeliveryError('timeout', false));
    await dispatcher.deliver(notification({ attempts: 5 }));
    expect(repo.markFailed).toHaveBeenCalled();
  });
});
