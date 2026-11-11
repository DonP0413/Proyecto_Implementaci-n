/**
 * Objetivo: seguimiento del trabajo (RF-05) y botones de notificación
 * manual (RF-06): cambio de estado según transiciones permitidas,
 * asignación de técnico, envío de cotización / listo para retirar e historial.
 */
import { useState } from 'react';
import type { WorkOrderDetail, WorkOrderStatus } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card } from '../../../components/ui/Feedback';
import { Textarea } from '../../../components/ui/FormField';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { StatusBadge } from '../components/StatusBadge';
import { useAssignTechnician, useChangeStatus, useSendQuotation, useSendReadyForPickup, useTechnicians } from '../hooks';

export function TrackingSection({ wo }: { wo: WorkOrderDetail }) {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canOperate = hasRole('RECEPCIONISTA', 'TECNICO');
  const [target, setTarget] = useState<WorkOrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [confirmNotify, setConfirmNotify] = useState<'quotation' | 'ready' | null>(null);

  const changeStatus = useChangeStatus(wo.id);
  const assign = useAssignTechnician(wo.id);
  const sendQuotation = useSendQuotation(wo.id);
  const sendReady = useSendReadyForPickup(wo.id);
  const { data: technicians } = useTechnicians();
  const latestQuotation = wo.clientVisible.quotations[0];

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

  const notify = async () => {
    try {
      if (confirmNotify === 'quotation') await sendQuotation.mutateAsync();
      if (confirmNotify === 'ready') await sendReady.mutateAsync();
      toast.success(`Correo encolado para ${wo.client.email}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setConfirmNotify(null);
    }
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
            <p className="muted">Mover a:</p>
            <div className="button-row">
              {wo.allowedTransitions.map((t) => (
                <Button key={t.status} variant="secondary" onClick={() => setTarget(t.status)}>
                  {t.label}
                </Button>
              ))}
              {wo.allowedTransitions.length === 0 && <span className="muted">Use las pestañas Cotización o Entrega.</span>}
            </div>

            <h3 className="subheading">Notificar al cliente</h3>
            <div className="button-row">
              <Button
                variant="primary"
                disabled={!wo.actions.canSendQuotation}
                title={wo.actions.canSendQuotation ? '' : 'Disponible en estado "Cotización generada"'}
                onClick={() => setConfirmNotify('quotation')}
              >
                Enviar cotización
              </Button>
              <Button
                variant="success"
                disabled={!wo.actions.canNotifyReadyForPickup}
                title={wo.actions.canNotifyReadyForPickup ? '' : 'Disponible en estado "Listo para retirar"'}
                onClick={() => setConfirmNotify('ready')}
              >
                Notificar listo para retirar
              </Button>
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

      <ConfirmDialog
        open={!!confirmNotify}
        title={confirmNotify === 'quotation' ? 'Enviar cotización' : 'Notificar listo para retirar'}
        confirmLabel="Enviar correo"
        loading={sendQuotation.isPending || sendReady.isPending}
        onCancel={() => setConfirmNotify(null)}
        onConfirm={notify}
        message={
          <p>
            Se enviará un correo a <strong>{wo.client.email}</strong>
            {confirmNotify === 'quotation' && latestQuotation
              ? ` con la cotización de ${formatMoney(latestQuotation.amount)} solicitando su aprobación.`
              : ' informando que su equipo está reparado y disponible para retiro.'}
          </p>
        }
      />
    </div>
  );
}
