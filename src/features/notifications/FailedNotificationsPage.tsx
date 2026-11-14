/** Objetivo: bandeja de correos fallidos (soporte operativo) con vista previa y reintento manual. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../../api/endpoints';
import type { NotificationItem } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { NotificationPreviewModal, NotificationRetryModal } from './NotificationModals';

export function FailedNotificationsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notifications', 'FAILED'],
    queryFn: () => notificationsApi.list('FAILED'),
  });
  const [toRetry, setToRetry] = useState<NotificationItem | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Correos fallidos</h1>
      </div>
      <Alert kind="info">
        Un correo se marca como fallido cuando el servidor de correo lo rechaza (p. ej. dirección inexistente o no autorizada) o tras agotar los
        reintentos automáticos. La orden igualmente se guarda; puede corregir el destinatario al reintentar.
      </Alert>
      <Card>
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <Alert kind="error">{getErrorMessage(error)}</Alert>
        ) : !data?.length ? (
          <EmptyState title="No hay correos fallidos" description="Todos los correos se enviaron correctamente." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Orden</th>
                <th>Tipo</th>
                <th>Destinatario</th>
                <th>Error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((n) => (
                <tr key={n.id}>
                  <td>{formatDateTime(n.createdAt)}</td>
                  <td>
                    <Link to={`/work-orders/${n.workOrderId}`} className="mono">
                      {n.workOrderCode ?? 'Ver orden'}
                    </Link>
                  </td>
                  <td>{n.typeLabel}</td>
                  <td>{n.recipientEmail}</td>
                  <td className="error-text small">{n.lastError}</td>
                  <td>
                    <div className="button-row">
                      <Button size="sm" variant="secondary" onClick={() => setPreviewId(n.id)}>
                        Ver correo
                      </Button>
                      <Button size="sm" onClick={() => setToRetry(n)}>
                        Reintentar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <NotificationPreviewModal notificationId={previewId} onClose={() => setPreviewId(null)} />
      <NotificationRetryModal notification={toRetry} onClose={() => setToRetry(null)} />
    </div>
  );
}
