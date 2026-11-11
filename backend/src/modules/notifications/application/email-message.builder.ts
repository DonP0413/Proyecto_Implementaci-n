/**
 * Objetivo: Builder Pattern para construir correos válidos paso a paso.
 * Garantiza destinatario, asunto y contenido antes de entregar el mensaje
 * al adaptador, y limita el tamaño total de adjuntos (Mailgun acepta 25 MB;
 * usamos 15 MB como margen de seguridad).
 */
import type { MailAttachment, OutgoingMail } from '../../../infrastructure/mail/mail-sender.port';

export const MAX_TOTAL_ATTACHMENTS_BYTES = 15 * 1024 * 1024;

export class EmailMessageBuilder {
  private mail: Partial<OutgoingMail> = { tags: [], attachments: [], variables: {} };
  private attachmentsBytes = 0;
  private readonly skipped: string[] = [];

  to(email: string): this {
    this.mail.to = email.trim();
    return this;
  }

  subject(subject: string): this {
    this.mail.subject = subject.trim();
    return this;
  }

  content(html: string, text: string): this {
    this.mail.html = html;
    this.mail.text = text;
    return this;
  }

  replyTo(email?: string): this {
    if (email) this.mail.replyTo = email;
    return this;
  }

  tag(tag: string): this {
    this.mail.tags!.push(tag);
    return this;
  }

  variable(key: string, value: string): this {
    this.mail.variables![key] = value;
    return this;
  }

  attach(attachment: MailAttachment): this {
    if (this.attachmentsBytes + attachment.content.length > MAX_TOTAL_ATTACHMENTS_BYTES) {
      this.skipped.push(attachment.filename);
      return this;
    }
    this.attachmentsBytes += attachment.content.length;
    this.mail.attachments!.push(attachment);
    return this;
  }

  get skippedAttachments(): string[] {
    return [...this.skipped];
  }

  build(): OutgoingMail {
    const { to, subject, html, text } = this.mail;
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Destinatario inválido');
    if (!subject) throw new Error('El asunto es obligatorio');
    if (!html || !text) throw new Error('El contenido del correo es obligatorio');
    return { ...this.mail, to, subject, html, text } as OutgoingMail;
  }
}
