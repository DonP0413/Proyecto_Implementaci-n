/**
 * Objetivo: ADAPTADOR de correo para Mailgun (API HTTP, no SMTP).
 * - Región US/EU configurable.
 * - Adjuntos (fotos y comprobante PDF) enviados como multipart.
 * - Tags y variables personalizadas para rastrear cada envío en el panel
 *   de Mailgun (work_order, notification_id).
 * - Clasificación de errores: 4xx (excepto 408/429) = permanente; resto = transitorio.
 */
import { Logger } from '@nestjs/common';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { MailDeliveryError, MailSender, MailSendResult, OutgoingMail } from './mail-sender.port';

export interface MailgunOptions {
  apiKey: string;
  domain: string;
  region: 'us' | 'eu';
  from: string;
  replyTo?: string;
  timeoutMs: number;
}

type MailgunClient = ReturnType<InstanceType<typeof Mailgun>['client']>;
type MailgunMessage = Parameters<MailgunClient['messages']['create']>[1];

export const isPermanentStatus = (status?: number): boolean =>
  status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;

const SANDBOX_RE = /sandbox subdomains|authorized recipients/i;
const INVALID_RECIPIENT_RE = /not a valid address|invalid.*recipient|recipient/i;

export const formatMailgunError = (err: {
  status?: number;
  message?: string;
  details?: string;
}): { message: string; permanent: boolean; status?: number } => {
  const status = typeof err.status === 'number' ? err.status : undefined;
  const raw = (err.details || err.message || 'error desconocido').trim();
  const permanent = isPermanentStatus(status) || SANDBOX_RE.test(raw) || INVALID_RECIPIENT_RE.test(raw);
  if (SANDBOX_RE.test(raw)) {
    return {
      status,
      permanent: true,
      message: `Mailgun ${status ?? 403}: Destinatario no autorizado en dominio Sandbox gratuito (${raw})`,
    };
  }
  if (status === 400 || INVALID_RECIPIENT_RE.test(raw)) {
    return {
      status,
      permanent: true,
      message: `Mailgun ${status ?? 400}: Dirección de correo rechazada o inválida (${raw})`,
    };
  }
  return { status, permanent, message: `Mailgun ${status ?? 'NETWORK'}: ${raw}` };
};

export class MailgunMailAdapter implements MailSender {
  readonly provider = 'mailgun';
  private readonly logger = new Logger(MailgunMailAdapter.name);
  private readonly client: MailgunClient;

  constructor(private readonly options: MailgunOptions) {
    const mailgun = new Mailgun(FormData);
    this.client = mailgun.client({
      username: 'api',
      key: options.apiKey,
      url: options.region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
      timeout: options.timeoutMs,
    });
  }

  async send(mail: OutgoingMail): Promise<MailSendResult> {
    const data: Record<string, unknown> = {
      from: this.options.from,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      'o:tracking': 'yes',
    };
    const replyTo = mail.replyTo ?? this.options.replyTo;
    if (replyTo) data['h:Reply-To'] = replyTo;
    if (mail.tags?.length) data['o:tag'] = mail.tags.slice(0, 3); // Mailgun admite hasta 3 tags
    if (mail.variables) data['h:X-Mailgun-Variables'] = JSON.stringify(mail.variables);
    if (mail.attachments?.length) {
      data.attachment = mail.attachments.map((att) => ({
        filename: att.filename,
        data: att.content,
        contentType: att.contentType,
      }));
    }

    try {
      const result = await this.client.messages.create(
        this.options.domain,
        data as unknown as MailgunMessage,
      );
      const messageId = result.id ?? 'unknown';
      this.logger.log({ to: mail.to, messageId, tags: mail.tags }, 'Correo aceptado por Mailgun');
      return { provider: this.provider, messageId };
    } catch (error) {
      const err = error as { status?: number; message?: string; details?: string };
      const formatted = formatMailgunError(err);
      throw new MailDeliveryError(formatted.message, formatted.permanent, formatted.status);
    }
  }
}
