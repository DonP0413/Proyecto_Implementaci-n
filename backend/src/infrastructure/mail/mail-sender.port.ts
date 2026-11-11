/**
 * Objetivo: PUERTO de envío de correo. Los casos de uso dependen de esta
 * abstracción, nunca del SDK de Mailgun. MailDeliveryError distingue fallos
 * permanentes (no reintentar: email inválido, credenciales) de transitorios
 * (reintentar: timeout, 429, 5xx).
 */
export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: string[];
  attachments?: MailAttachment[];
  /** Variables personalizadas que Mailgun devuelve en webhooks/logs (trazabilidad) */
  variables?: Record<string, string>;
}

export interface MailSendResult {
  provider: string;
  messageId: string;
}

export interface MailSender {
  readonly provider: string;
  send(mail: OutgoingMail): Promise<MailSendResult>;
}

export class MailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly permanent: boolean,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}
