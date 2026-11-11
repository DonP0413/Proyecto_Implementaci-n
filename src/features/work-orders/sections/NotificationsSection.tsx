/** Objetivo: historial de correos de la orden con su estado de envío y reintento manual. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { Badge, Card, Spinner } from '../../../components/ui/Feedback';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { NOTIFICATION_STATUS_LABELS, NOTIFICATION_STATUS_TONES } from '../constants';
import { useWorkOrderNotifications, workOrderKeys } from '../hooks';

export function NotificationsSection({ workOrderId }: { workOrderId: string }) {
  const { data, isLoading } = useWorkOrderNotifications(workOrderId);
  const canRetry = useAuthStore((s) => s.hasRole('RECEPCIONISTA'));
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: notificationsApi.retry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workOrderKeys.notifications(workOrderId) }),
  });

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
                  {n.status === 'FAILED' && canRetry && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={retry.isPending && retry.variables === n.id}
                      onClick={() =>
                        retry
                          .mutateAsync(n.id)
                          .then(() => toast.success('Reintento programado'))
                          .catch((e) => toast.error(getErrorMessage(e)))
                      }
                    >
                      Reintentar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
