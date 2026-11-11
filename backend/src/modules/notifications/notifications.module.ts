/**
 * Objetivo: ensamblar el módulo de notificaciones. Es independiente de
 * work-orders (no lo importa): recibe todo lo necesario en el payload del
 * outbox. Así se evita una dependencia circular y el módulo podría
 * extraerse a un microservicio en el futuro.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { NotificationDispatcherService } from './application/notification-dispatcher.service';
import { NotificationsService } from './application/notifications.service';
import { TemplateRendererService } from './application/template-renderer.service';
import { ExponentialBackoffRetryPolicy, RETRY_POLICY } from './domain/retry-policy';
import { NotificationEntity } from './infrastructure/notification.entity';
import { NotificationsRepository } from './infrastructure/notifications.repository';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity]), MailModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationDispatcherService,
    TemplateRendererService,
    {
      provide: RETRY_POLICY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ExponentialBackoffRetryPolicy(config.get<number>('notifications.baseDelaySeconds') ?? 30),
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
