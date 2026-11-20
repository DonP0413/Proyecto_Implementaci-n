/**
 * Objetivo: estados internos del proceso de reparación (requerimiento 5) y
 * la MÁQUINA DE ESTADOS que define qué transiciones son válidas.
 *
 *  INGRESADO -> EN_REVISION -> COTIZACION_GENERADA -> EN_REPARACION -> LISTO_PARA_RETIRAR -> ENTREGADO
 *
 * Transiciones alternativas justificadas por la operación real del taller:
 *  - EN_REVISION -> EN_REPARACION: garantía o trabajo sin costo (no requiere cotización).
 *  - EN_REVISION / COTIZACION_GENERADA -> LISTO_PARA_RETIRAR: el equipo no tiene
 *    reparación o el cliente no aceptó; se devuelve sin reparar.
 *  - COTIZACION_GENERADA -> EN_REVISION: se requiere re-diagnóstico / re-cotización.
 *  - EN_REPARACION -> EN_REVISION: aparece una falla adicional durante la reparación.
 *  - LISTO_PARA_RETIRAR -> EN_REPARACION: el control de calidad detecta un problema.
 *  - LISTO_PARA_RETIRAR -> EN_REVISION: el equipo se iba a devolver sin reparar, pero el
 *    cliente decide repararlo: se vuelve a revisar para emitir una nueva cotización.
 *  - ENTREGADO es terminal (un reingreso es una nueva orden, conservando historial).
 *
 * COTIZACION_GENERADA y ENTREGADO SÓLO se alcanzan por sus casos de uso
 * dedicados (registrar cotización / registrar entrega) porque exigen datos.
 */
import { BusinessRuleError } from '../../../common/errors/domain.errors';

export enum WorkOrderStatus {
  INGRESADO = 'INGRESADO',
  EN_REVISION = 'EN_REVISION',
  COTIZACION_GENERADA = 'COTIZACION_GENERADA',
  EN_REPARACION = 'EN_REPARACION',
  LISTO_PARA_RETIRAR = 'LISTO_PARA_RETIRAR',
  ENTREGADO = 'ENTREGADO',
}

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.INGRESADO]: 'Ingresado',
  [WorkOrderStatus.EN_REVISION]: 'En revisión',
  [WorkOrderStatus.COTIZACION_GENERADA]: 'Cotización generada',
  [WorkOrderStatus.EN_REPARACION]: 'En reparación',
  [WorkOrderStatus.LISTO_PARA_RETIRAR]: 'Listo para retirar',
  [WorkOrderStatus.ENTREGADO]: 'Entregado',
};

const TRANSITIONS: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  [WorkOrderStatus.INGRESADO]: [WorkOrderStatus.EN_REVISION],
  [WorkOrderStatus.EN_REVISION]: [
    WorkOrderStatus.COTIZACION_GENERADA,
    WorkOrderStatus.EN_REPARACION,
    WorkOrderStatus.LISTO_PARA_RETIRAR,
  ],
  [WorkOrderStatus.COTIZACION_GENERADA]: [
    WorkOrderStatus.EN_REPARACION,
    WorkOrderStatus.LISTO_PARA_RETIRAR,
    WorkOrderStatus.EN_REVISION,
  ],
  [WorkOrderStatus.EN_REPARACION]: [WorkOrderStatus.LISTO_PARA_RETIRAR, WorkOrderStatus.EN_REVISION],
  [WorkOrderStatus.LISTO_PARA_RETIRAR]: [
    WorkOrderStatus.ENTREGADO,
    WorkOrderStatus.EN_REPARACION,
    WorkOrderStatus.EN_REVISION,
  ],
  [WorkOrderStatus.ENTREGADO]: [],
};

/** Estados a los que sólo se llega mediante un caso de uso con datos propios. */
export const DEDICATED_TRANSITION_TARGETS: readonly WorkOrderStatus[] = [
  WorkOrderStatus.COTIZACION_GENERADA,
  WorkOrderStatus.ENTREGADO,
];

/** Largo mínimo de la nota obligatoria. */
export const MIN_STATUS_NOTE_LENGTH = 5;

/**
 * Transiciones ALTERNATIVAS (fuera del camino normal revisión → cotización →
 * reparación → listo): están permitidas porque ocurren en el taller, pero exigen
 * una nota que explique el motivo, para que quede en el historial.
 */
const NOTE_REQUIRED: Partial<Record<WorkOrderStatus, Partial<Record<WorkOrderStatus, string>>>> = {
  [WorkOrderStatus.EN_REVISION]: {
    [WorkOrderStatus.EN_REPARACION]:
      'Indique por qué se repara sin cotización (p. ej. garantía o trabajo sin costo)',
    [WorkOrderStatus.LISTO_PARA_RETIRAR]:
      'Indique por qué se devuelve sin reparar (p. ej. el equipo no tiene reparación)',
  },
  [WorkOrderStatus.COTIZACION_GENERADA]: {
    [WorkOrderStatus.LISTO_PARA_RETIRAR]:
      'Indique por qué se devuelve sin reparar (p. ej. el cliente no aprobó la cotización)',
    [WorkOrderStatus.EN_REVISION]: 'Indique por qué se vuelve a revisar el equipo (re-diagnóstico)',
  },
  [WorkOrderStatus.EN_REPARACION]: {
    [WorkOrderStatus.EN_REVISION]: 'Describa la falla adicional encontrada durante la reparación',
  },
  [WorkOrderStatus.LISTO_PARA_RETIRAR]: {
    [WorkOrderStatus.EN_REPARACION]: 'Describa el problema detectado en el control de calidad',
    [WorkOrderStatus.EN_REVISION]:
      'Indique por qué se vuelve a revisar (p. ej. el cliente decidió reparar y se emitirá una nueva cotización)',
  },
};

export class WorkOrderStateMachine {
  /** Indicación para la nota obligatoria, o null si la transición es la normal (nota opcional). */
  static notePrompt(from: WorkOrderStatus, to: WorkOrderStatus): string | null {
    return NOTE_REQUIRED[from]?.[to] ?? null;
  }

  static assertNote(from: WorkOrderStatus, to: WorkOrderStatus, note: string | null | undefined): void {
    const prompt = WorkOrderStateMachine.notePrompt(from, to);
    if (prompt && (note ?? '').trim().length < MIN_STATUS_NOTE_LENGTH) {
      throw new BusinessRuleError(
        `Este cambio de estado requiere una nota. ${prompt}.`,
        'STATUS_NOTE_REQUIRED',
        {
          from,
          to,
        },
      );
    }
  }

  static allowedTransitions(from: WorkOrderStatus): WorkOrderStatus[] {
    return [...TRANSITIONS[from]];
  }

  static canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  static assertTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
    if (!WorkOrderStateMachine.canTransition(from, to)) {
      const allowed = TRANSITIONS[from];
      const allowedLabels = allowed.map((s) => `"${WORK_ORDER_STATUS_LABELS[s]}"`).join(', ');
      const suffix = allowedLabels ? ` Siguiente estado permitido: ${allowedLabels}.` : '';
      throw new BusinessRuleError(
        `No se puede pasar de "${WORK_ORDER_STATUS_LABELS[from]}" a "${WORK_ORDER_STATUS_LABELS[to]}".${suffix}`,
        'INVALID_STATUS_TRANSITION',
        { from, to, allowed },
      );
    }
  }

  /** Transiciones que el personal puede ejecutar con el botón genérico "Cambiar estado". */
  static manualTransitions(from: WorkOrderStatus): WorkOrderStatus[] {
    return TRANSITIONS[from].filter((s) => !DEDICATED_TRANSITION_TARGETS.includes(s));
  }
}
