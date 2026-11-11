/** Objetivo: bandeja de correos fallidos (soporte operativo) con reintento manual. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { ConfirmDialog } from '../../components/ui/Modal';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { toast } from '../../stores/toastStore';

export function FailedNotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['notifications', 'FAILED'], queryFn: () => notificationsApi.list('FAILED') });
  const retry = useMutation({
    mutationFn: notificationsApi.retry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const [toRetry, setToRetry] = useState<{ id: string; recipientEmail: string; typeLabel: string } | null>(null);
  const confirmRetry = () =>
    toRetry &&
    retry
      .mutateAsync(toRetry.id)
      .then(() => toast.success('Reintento programado'))
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setToRetry(null));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Correos fallidos</h1>
      </div>
      <Alert kind="info">
        Un correo se marca como fallido cuando Mailgun lo rechaza (p. ej. dirección inválida) o tras agotar los reintentos automáticos. Corrija el
        correo del cliente si es necesario y reintente.
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
                    <Link to={`/work-orders/${n.workOrderId}`}>{n.typeLabel}</Link>
                  </td>
                  <td>{n.recipientEmail}</td>
                  <td className="error-text small">{n.lastError}</td>
                  <td>
                    <Button
                      size="sm"
                      loading={retry.isPending && retry.variables === n.id}
                      onClick={() => setToRetry(n)}
                    >
                      Reintentar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <ConfirmDialog
        open={!!toRetry}
        title="¿Está seguro de reintentar el envío?"
        confirmLabel="Sí, reintentar"
        loading={retry.isPending}
        onCancel={() => setToRetry(null)}
        onConfirm={confirmRetry}
        message={
          <p>
            Se volverá a enviar el correo <strong>{toRetry?.typeLabel}</strong> a <strong>{toRetry?.recipientEmail}</strong>. Si la dirección es
            incorrecta, corríjala primero en la ficha del cliente.
          </p>
        }
      />
    </div>
  );
}
