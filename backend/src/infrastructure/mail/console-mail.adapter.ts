/**
 * Objetivo: ADAPTADOR de correo para desarrollo y pruebas. No envía nada:
 * registra el correo en el log y, si MAIL_PREVIEW_DIR está definido, guarda
 * el HTML para revisarlo en el navegador. Evita gastar cuota de Mailgun y
 * enviar correos reales a clientes desde entornos Dev/QA.
 */
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { MailSender, MailSendResult, OutgoingMail } from './mail-sender.port';

export class ConsoleMailAdapter implements MailSender {
  readonly provider = 'console';
  private readonly logger = new Logger(ConsoleMailAdapter.name);

  constructor(private readonly previewDir?: string) {}

  async send(mail: OutgoingMail): Promise<MailSendResult> {
    const messageId = `console-${randomUUID()}`;
    this.logger.log(
      {
        messageId,
        to: mail.to,
        subject: mail.subject,
        tags: mail.tags,
        attachments: mail.attachments?.map((a) => `${a.filename} (${a.content.length} bytes)`),
      },
      'Correo simulado (MAIL_DRIVER=console)',
    );
    if (this.previewDir) {
      await fs.mkdir(this.previewDir, { recursive: true });
      await fs.writeFile(path.join(this.previewDir, `${messageId}.html`), mail.html, 'utf8');
    }
    return { provider: this.provider, messageId };
  }
}
