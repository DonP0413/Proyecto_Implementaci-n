/**
 * Objetivo: vocabulario del dominio de notificaciones.
 *  - RECEPTION y DELIVERY: automáticas (requerimientos 4 y 8).
 *  - QUOTATION y READY_FOR_PICKUP: manuales mediante botón (requerimiento 6).
 */
export enum NotificationType {
  RECEPTION = 'RECEPTION',
  QUOTATION = 'QUOTATION',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  DELIVERY = 'DELIVERY',
}

export enum NotificationTrigger {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, string> = {
  [NotificationType.RECEPTION]: 'reception',
  [NotificationType.QUOTATION]: 'quotation',
  [NotificationType.READY_FOR_PICKUP]: 'ready-for-pickup',
  [NotificationType.DELIVERY]: 'delivery',
};

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  [NotificationType.RECEPTION]: 'Confirmación de ingreso',
  [NotificationType.QUOTATION]: 'Cotización generada',
  [NotificationType.READY_FOR_PICKUP]: 'Listo para retirar',
  [NotificationType.DELIVERY]: 'Confirmación de entrega',
};

export interface NotificationAttachmentRef {
  storageKey: string;
  filename: string;
  mimeType: string;
}

export interface NotificationPayload {
  data: Record<string, unknown>;
  attachments: NotificationAttachmentRef[];
}

export const NOTIFICATION_ENQUEUED_EVENT = 'notification.enqueued';
