/**
 * Objetivo: seleccionar el adaptador de correo (Strategy) según MAIL_DRIVER:
 *   - console  -> desarrollo / CI
 *   - mailgun  -> staging / producción
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleMailAdapter } from './console-mail.adapter';
import { MAIL_SENDER, MailSender } from './mail-sender.port';
import { MailgunMailAdapter } from './mailgun-mail.adapter';

@Module({
  providers: [
    {
      provide: MAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailSender => {
        if (config.get<string>('mail.driver') === 'mailgun') {
          return new MailgunMailAdapter({
            apiKey: config.getOrThrow<string>('mail.mailgun.apiKey'),
            domain: config.getOrThrow<string>('mail.mailgun.domain'),
            region: config.get<'us' | 'eu'>('mail.mailgun.region') ?? 'us',
            timeoutMs: config.get<number>('mail.mailgun.timeoutMs') ?? 15000,
            from: config.getOrThrow<string>('mail.from'),
            replyTo: config.get<string>('mail.replyTo') || undefined,
          });
        }
        return new ConsoleMailAdapter(process.env.MAIL_PREVIEW_DIR);
      },
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
