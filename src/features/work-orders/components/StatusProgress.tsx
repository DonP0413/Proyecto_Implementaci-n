/** Objetivo: barra de progreso visual del flujo de reparación (6 estados). */
import type { WorkOrderStatus } from '../../../api/types';
import { STATUS_LABELS, STATUS_ORDER } from '../constants';

export function StatusProgress({ status }: { status: WorkOrderStatus }) {
  const current = STATUS_ORDER.indexOf(status);
  return (
    <ol className="progress" aria-label="Progreso de la reparación">
      {STATUS_ORDER.map((step, index) => (
        <li
          key={step}
          className={`progress-step ${index < current ? 'done' : ''} ${index === current ? 'current' : ''}`}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="progress-dot">{index < current ? '✓' : index + 1}</span>
          <span className="progress-label">{STATUS_LABELS[step]}</span>
        </li>
      ))}
    </ol>
  );
}
