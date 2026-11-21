/** Objetivo: etiquetas y colores de estados, coherentes en toda la UI. */
import type { PhysicalCondition, PowerStatus, WorkOrderStatus } from '../../api/types';

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

/** Pestañas del detalle de la orden. */
export type WorkOrderTab = 'reception' | 'tracking' | 'quotation' | 'technical' | 'delivery';

/**
 * Siguiente paso del camino normal según el estado, y en qué pestaña se hace.
 * Se usa para guiar al personal desde Seguimiento (aviso "Siguiente paso" con botón a esa pestaña).
 */
export const NEXT_STEP: Record<WorkOrderStatus, { tab: WorkOrderTab; text: string } | null> = {
  INGRESADO: { tab: 'tracking', text: 'Pase la orden a "En revisión" para diagnosticar el equipo' },
  EN_REVISION: { tab: 'quotation', text: 'Registre la cotización y genere su PDF' },
  COTIZACION_GENERADA: { tab: 'tracking', text: 'Cuando el cliente apruebe, pase la orden a "En reparación"' },
  EN_REPARACION: { tab: 'tracking', text: 'Al terminar, pase la orden a "Listo para retirar"' },
  LISTO_PARA_RETIRAR: { tab: 'delivery', text: 'Registre la entrega y genere el comprobante de entrega' },
  ENTREGADO: null,
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

export const MAX_PHOTOS = 6;
export const MAX_FILE_MB = 8;
