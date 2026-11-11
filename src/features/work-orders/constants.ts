/** Objetivo: etiquetas y colores de estados, coherentes en toda la UI. */
import type { NotificationStatus, PhysicalCondition, PowerStatus, WorkOrderStatus } from '../../api/types';

export const STATUS_ORDER: WorkOrderStatus[] = [
  'INGRESADO',
  'EN_REVISION',
  'COTIZACION_GENERADA',
  'EN_REPARACION',
  'LISTO_PARA_RETIRAR',
  'ENTREGADO',
];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  INGRESADO: 'Ingresado',
  EN_REVISION: 'En revisión',
  COTIZACION_GENERADA: 'Cotización generada',
  EN_REPARACION: 'En reparación',
  LISTO_PARA_RETIRAR: 'Listo para retirar',
  ENTREGADO: 'Entregado',
};

export const STATUS_TONES: Record<WorkOrderStatus, string> = {
  INGRESADO: 'gray',
  EN_REVISION: 'blue',
  COTIZACION_GENERADA: 'orange',
  EN_REPARACION: 'purple',
  LISTO_PARA_RETIRAR: 'green',
  ENTREGADO: 'teal',
};

export const POWER_STATUS_OPTIONS: Array<{ value: PowerStatus; label: string }> = [
  { value: 'SI', label: 'Sí enciende' },
  { value: 'NO', label: 'No enciende' },
  { value: 'NO_PROBADO', label: 'No se pudo probar' },
];

export const PHYSICAL_CONDITION_OPTIONS: Array<{ value: PhysicalCondition; label: string }> = [
  { value: 'BUENO', label: 'Bueno' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'MALO', label: 'Malo' },
];

export const COMMON_ACCESSORIES = ['Cargador', 'Cable de poder', 'Batería', 'Cable USB', 'Mouse', 'Funda / estuche', 'Filamento'];

export const NOTIFICATION_STATUS_TONES: Record<NotificationStatus, string> = {
  PENDING: 'orange',
  SENDING: 'blue',
  SENT: 'green',
  FAILED: 'red',
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  PENDING: 'Pendiente',
  SENDING: 'Enviando',
  SENT: 'Enviado',
  FAILED: 'Fallido',
};

export const MAX_PHOTOS = 6;
export const MAX_FILE_MB = 8;
