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
  [WorkOrderStatus.LISTO_PARA_RETIRAR]: [WorkOrderStatus.ENTREGADO, WorkOrderStatus.EN_REPARACION],
  [WorkOrderStatus.ENTREGADO]: [],
};

/** Estados a los que sólo se llega mediante un caso de uso con datos propios. */
export const DEDICATED_TRANSITION_TARGETS: readonly WorkOrderStatus[] = [
  WorkOrderStatus.COTIZACION_GENERADA,
  WorkOrderStatus.ENTREGADO,
];

export class WorkOrderStateMachine {
  static allowedTransitions(from: WorkOrderStatus): WorkOrderStatus[] {
    return [...TRANSITIONS[from]];
  }

  static canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  static assertTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
    if (!WorkOrderStateMachine.canTransition(from, to)) {
      throw new BusinessRuleError(
        `No se puede pasar de "${WORK_ORDER_STATUS_LABELS[from]}" a "${WORK_ORDER_STATUS_LABELS[to]}"`,
        'INVALID_STATUS_TRANSITION',
        { from, to, allowed: TRANSITIONS[from] },
      );
    }
  }

  /** Transiciones que el personal puede ejecutar con el botón genérico "Cambiar estado". */
  static manualTransitions(from: WorkOrderStatus): WorkOrderStatus[] {
    return TRANSITIONS[from].filter((s) => !DEDICATED_TRANSITION_TARGETS.includes(s));
  }
}
