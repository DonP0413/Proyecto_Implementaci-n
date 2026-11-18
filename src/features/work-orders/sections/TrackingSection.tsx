/**
 * Objetivo: seguimiento del trabajo (RF-05): cambio de estado según
 * transiciones permitidas, asignación de técnico e historial.
 */
import { useState } from 'react';
import type { WorkOrderDetail, WorkOrderStatus } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card } from '../../../components/ui/Feedback';
import { Textarea } from '../../../components/ui/FormField';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { StatusBadge } from '../components/StatusBadge';
import { STATUS_LABELS, STATUS_ORDER } from '../constants';
import { useAssignTechnician, useChangeStatus, useTechnicians } from '../hooks';

export function TrackingSection({ wo }: { wo: WorkOrderDetail }) {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canOperate = hasRole('RECEPCIONISTA', 'TECNICO');
  const [target, setTarget] = useState<WorkOrderStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const changeStatus = useChangeStatus(wo.id);
  const assign = useAssignTechnician(wo.id);
  const { data: technicians } = useTechnicians();

  const confirmChange = async () => {
    if (!target) return;
    try {
      await changeStatus.mutateAsync({ status: target, note: note.trim() || undefined });
      toast.success('Estado actualizado');
      setTarget(null);
      setNote('');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const allowedStatuses = new Set(wo.allowedTransitions.map((t) => t.status));

  const handleTransitionClick = (status: WorkOrderStatus) => {
    if (allowedStatuses.has(status)) {
      setTransitionError(null);
      setTarget(status);
      return;
    }

    if (wo.status === 'LISTO_PARA_RETIRAR' && status === 'ENTREGADO') {
      const msg = 'Para pasar a "Entregado", registre la entrega en la pestaña Entrega.';
      setTransitionError(msg);
      toast.error(msg);
      return;
    }

    const nextAllowed =
      wo.allowedTransitions.length > 0
        ? wo.allowedTransitions.map((t) => `"${t.label}"`).join(' o ')
        : wo.status === 'EN_REVISION'
          ? '"Cotización generada" (desde la pestaña Cotización)'
          : wo.status === 'LISTO_PARA_RETIRAR'
            ? '"Entregado" (desde la pestaña Entrega)'
            : 'completar el flujo secuencial';

    const msg = `No se puede pasar de "${STATUS_LABELS[wo.status]}" directamente a "${STATUS_LABELS[status]}". Siguiente estado permitido: ${nextAllowed}.`;
    setTransitionError(msg);
    toast.error(msg);
  };

  return (
    <div className="grid-2">
      <Card title="Acciones">
        {wo.status === 'ENTREGADO' ? (
          <Alert kind="success">Orden cerrada: el equipo fue entregado.</Alert>
        ) : !canOperate ? (
          <p className="muted">Su rol sólo permite consultar.</p>
        ) : (
          <>
            <p className="muted">
              Mover a: <span className="status-move-legend">estados disponibles ahora</span>
            </p>
            {transitionError && <Alert kind="error">{transitionError}</Alert>}
            <div className="button-row">
              {STATUS_ORDER.filter((s) => s !== wo.status).map((status) => {
                const isAllowed = allowedStatuses.has(status);
                return (
                  <Button
                    key={status}
                    variant={isAllowed ? 'primary' : 'secondary'}
                    className={isAllowed ? 'status-move status-move-allowed' : 'status-move status-move-blocked'}
                    title={isAllowed ? 'Cambiar a este estado' : 'No disponible desde el estado actual'}
                    onClick={() => handleTransitionClick(status)}
                  >
                    {STATUS_LABELS[status]}
                  </Button>
                );
              })}
            </div>

            <h3 className="subheading">Técnico responsable</h3>
            <select
              aria-label="Técnico responsable"
              value={wo.assignedTechnician?.id ?? ''}
              disabled={assign.isPending}
              onChange={(e) =>
                assign
                  .mutateAsync(e.target.value || null)
                  .then(() => toast.success('Técnico asignado'))
                  .catch((err) => toast.error(getErrorMessage(err)))
              }
            >
              <option value="">Sin asignar</option>
              {technicians?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </>
        )}
      </Card>

      <Card title="Historial de estados">
        <ol className="timeline">
          {wo.statusHistory.map((h, index) => (
            <li key={index}>
              <div className="timeline-head">
                <StatusBadge status={h.toStatus} />
                <small className="muted">{formatDateTime(h.changedAt)}</small>
              </div>
              <small>
                {h.changedBy?.fullName ?? 'Sistema'}
                {h.note ? ` — ${h.note}` : ''}
              </small>
            </li>
          ))}
        </ol>
      </Card>

      <ConfirmDialog
        open={!!target}
        title="Cambiar estado"
        confirmLabel="Cambiar estado"
        loading={changeStatus.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={confirmChange}
        message={
          <>
            <p>
              La orden <strong>{wo.code}</strong> pasará a <strong>{wo.allowedTransitions.find((t) => t.status === target)?.label}</strong>.
            </p>
            <Textarea label="Nota (opcional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </>
        }
      />
    </div>
  );
}
