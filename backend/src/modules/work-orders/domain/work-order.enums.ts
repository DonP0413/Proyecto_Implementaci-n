/**
 * Objetivo: enumeraciones del dominio de órdenes y reglas de visibilidad.
 * La separación CLIENT / INTERNAL implementa el requerimiento 7: el registro
 * técnico y sus documentos NUNCA salen hacia el cliente.
 */
export enum PowerStatus {
  SI = 'SI',
  NO = 'NO',
  NO_PROBADO = 'NO_PROBADO',
}

export enum PhysicalCondition {
  BUENO = 'BUENO',
  REGULAR = 'REGULAR',
  MALO = 'MALO',
}

export enum AttachmentCategory {
  RECEPTION_PHOTO = 'RECEPTION_PHOTO',
  DELIVERY_PHOTO = 'DELIVERY_PHOTO',
  TECHNICAL_DOCUMENT = 'TECHNICAL_DOCUMENT',
  RECEIPT_PDF = 'RECEIPT_PDF',
}

export enum AttachmentVisibility {
  CLIENT = 'CLIENT',
  INTERNAL = 'INTERNAL',
}

export const ATTACHMENT_VISIBILITY: Record<AttachmentCategory, AttachmentVisibility> = {
  [AttachmentCategory.RECEPTION_PHOTO]: AttachmentVisibility.CLIENT,
  [AttachmentCategory.DELIVERY_PHOTO]: AttachmentVisibility.CLIENT,
  [AttachmentCategory.RECEIPT_PDF]: AttachmentVisibility.CLIENT,
  [AttachmentCategory.TECHNICAL_DOCUMENT]: AttachmentVisibility.INTERNAL,
};

export const POWER_STATUS_LABELS: Record<PowerStatus, string> = {
  [PowerStatus.SI]: 'Sí enciende',
  [PowerStatus.NO]: 'No enciende',
  [PowerStatus.NO_PROBADO]: 'No se pudo probar',
};

export const PHYSICAL_CONDITION_LABELS: Record<PhysicalCondition, string> = {
  [PhysicalCondition.BUENO]: 'Bueno',
  [PhysicalCondition.REGULAR]: 'Regular',
  [PhysicalCondition.MALO]: 'Malo',
};

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const DOCUMENT_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
] as const;
