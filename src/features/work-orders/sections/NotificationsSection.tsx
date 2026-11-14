/** Objetivo: historial de correos de la orden con vista previa, estado de envío y reintento manual. */
import { useState } from 'react';
import type { NotificationItem } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Badge, Card, Spinner } from '../../../components/ui/Feedback';
import { formatDateTime } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { NotificationPreviewModal, NotificationRetryModal } from '../../notifications/NotificationModals';
import { NOTIFICATION_STATUS_LABELS, NOTIFICATION_STATUS_TONES } from '../constants';
import { useWorkOrderNotifications } from '../hooks';

export function NotificationsSection({ workOrderId }: { workOrderId: string }) {
  const { data, isLoading } = useWorkOrderNotifications(workOrderId);
  const canOperate = useAuthStore((s) => s.hasRole('RECEPCIONISTA', 'TECNICO'));
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [toRetry, setToRetry] = useState<NotificationItem | null>(null);

  if (isLoading) return <Spinner />;
  return (
    <Card title="Correos enviados al cliente">
      {!data?.length ? (
        <p className="muted">Sin notificaciones.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Origen</th>
              <th>Destinatario</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((n) => (
              <tr key={n.id}>
                <td>{n.typeLabel}</td>
                <td>{n.trigger === 'AUTOMATIC' ? 'Automático' : 'Manual'}</td>
                <td>{n.recipientEmail}</td>
                <td>
                  <Badge tone={NOTIFICATION_STATUS_TONES[n.status]}>{NOTIFICATION_STATUS_LABELS[n.status]}</Badge>
                  {n.status === 'FAILED' && n.lastError && <div className="error-text small">{n.lastError}</div>}
                  {n.status === 'PENDING' && n.attempts > 0 && (
                    <div className="muted small">
                      Reintento {n.attempts}/{n.maxAttempts} · {formatDateTime(n.nextAttemptAt)}
                    </div>
                  )}
                </td>
                <td>{formatDateTime(n.sentAt ?? n.createdAt)}</td>
                <td>
                  <div className="button-row">
                    {canOperate && (
                      <Button size="sm" variant="secondary" onClick={() => setPreviewId(n.id)}>
                        Ver correo
                      </Button>
                    )}
                    {n.status === 'FAILED' && canOperate && (
                      <Button size="sm" onClick={() => setToRetry(n)}>
                        Reintentar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <NotificationPreviewModal notificationId={previewId} onClose={() => setPreviewId(null)} />
      <NotificationRetryModal notification={toRetry} onClose={() => setToRetry(null)} />
    </Card>
  );
}
