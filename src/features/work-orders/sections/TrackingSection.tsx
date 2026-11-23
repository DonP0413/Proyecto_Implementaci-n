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
import { NEXT_STEP, STATUS_LABELS, STATUS_ORDER, type WorkOrderTab } from '../constants';
import { useAssignTechnician, useChangeStatus, useTechnicians } from '../hooks';

/** Igual que MIN_STATUS_NOTE_LENGTH del backend (work-order-status.ts). */
const MIN_STATUS_NOTE_LENGTH = 5;

const TAB_NAMES: Record<WorkOrderTab, string> = {
  reception: 'Recepción',
  tracking: 'Seguimiento',
  quotation: 'Cotización',
  technical: 'Registro técnico',
  delivery: 'Entrega',
};

export function TrackingSection({ wo, onGoToTab }: { wo: WorkOrderDetail; onGoToTab?: (tab: WorkOrderTab) => void }) {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canOperate = hasRole('RECEPCIONISTA', 'TECNICO');
  const [target, setTarget] = useState<WorkOrderStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  const changeStatus = useChangeStatus(wo.id);
  const assign = useAssignTechnician(wo.id);
  const { data: technicians } = useTechnicians();

  const selected = wo.allowedTransitions.find((t) => t.status === target);
  const notePrompt = selected?.notePrompt ?? null;

  const closeDialog = () => {
    setTarget(null);
    setNote('');
    setNoteError(null);
  };

  const confirmChange = async () => {
    if (!target) return;
    // Caminos alternativos (p. ej. reparar sin cotizar): el motivo es obligatorio y queda en el historial.
    if (notePrompt && note.trim().length < MIN_STATUS_NOTE_LENGTH) {
      setNoteError(`Escriba el motivo (mínimo ${MIN_STATUS_NOTE_LENGTH} caracteres).`);
      return;
    }
    try {
      await changeStatus.mutateAsync({ status: target, note: note.trim() || undefined });
      toast.success('Estado actualizado');
      closeDialog();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const allowedStatuses = new Set(wo.allowedTransitions.map((t) => t.status));
  /** Caminos alternativos: permitidos, pero exigen motivo (se muestran como secundarios). */
  const alternativeStatuses = new Set(wo.allowedTransitions.filter((t) => t.notePrompt).map((t) => t.status));
  const nextStep = NEXT_STEP[wo.status];

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
            {nextStep && nextStep.tab !== 'tracking' && (
              <Alert kind="info">
                <div className="review-head">
                  <span>
                    <strong>Siguiente paso:</strong> {nextStep.text} en la pestaña <strong>{TAB_NAMES[nextStep.tab]}</strong>.
                  </span>
                  {onGoToTab && (
                    <Button size="sm" onClick={() => onGoToTab(nextStep.tab)}>
                      Ir a {TAB_NAMES[nextStep.tab]}
                    </Button>
                  )}
                </div>
              </Alert>
            )}
            <p className="muted">
              Mover a: <span className="status-move-legend">estados disponibles ahora</span>
            </p>
            {transitionError && <Alert kind="error">{transitionError}</Alert>}
            <div className="button-row">
              {STATUS_ORDER.filter((s) => s !== wo.status).map((status) => {
                const isAllowed = allowedStatuses.has(status);
                const isAlternative = alternativeStatuses.has(status);
                const className = !isAllowed
                  ? 'status-move status-move-blocked'
                  : isAlternative
                    ? 'status-move status-move-alt'
                    : 'status-move status-move-allowed';
                return (
                  <Button
                    key={status}
                    variant={isAllowed && !isAlternative ? 'primary' : 'secondary'}
                    className={className}
                    title={
                      !isAllowed
                        ? 'No disponible desde el estado actual'
                        : isAlternative
                          ? 'Camino alternativo: se pedirá el motivo'
                          : 'Cambiar a este estado'
                    }
                    onClick={() => handleTransitionClick(status)}
                  >
                    {STATUS_LABELS[status]}
                    {isAlternative && <small className="status-move-note">requiere motivo</small>}
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
        onCancel={closeDialog}
        onConfirm={confirmChange}
        message={
          <>
            <p>
              La orden <strong>{wo.code}</strong> pasará a <strong>{selected?.label}</strong>.
            </p>
            {notePrompt && (
              <Alert kind="warning">
                Este no es el camino habitual del proceso. <strong>{notePrompt}.</strong> El motivo quedará en el historial de estados.
              </Alert>
            )}
            <Textarea
              label={notePrompt ? 'Motivo del cambio' : 'Nota (opcional)'}
              required={!!notePrompt}
              value={note}
              maxLength={500}
              error={noteError ?? undefined}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError) setNoteError(null);
              }}
            />
          </>
        }
      />
    </div>
  );
}
