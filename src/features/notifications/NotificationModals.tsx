/** Objetivo: modales compartidos para previsualizar el contenido de un correo y reintentar un envío fallido corrigiendo el destinatario si hace falta. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { notificationsApi } from '../../api/endpoints';
import type { NotificationItem } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Alert, Spinner } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { getErrorMessage } from '../../lib/errors';
import { toast } from '../../stores/toastStore';

export function NotificationPreviewModal({
  notificationId,
  onClose,
}: {
  notificationId: string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'html' | 'text'>('html');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notifications', 'preview', notificationId],
    queryFn: () => notificationsApi.preview(notificationId ?? ''),
    enabled: !!notificationId,
  });

  useEffect(() => {
    setMode('html');
  }, [notificationId]);

  return (
    <Modal open={!!notificationId} size="lg" title="Contenido del correo" onClose={onClose}>
      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <Alert kind="error">{getErrorMessage(error)}</Alert>
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="review-head">
            <div>
              <div>
                <strong>Asunto:</strong> {data.subject}
              </div>
              <div className="muted small">
                <strong>Para:</strong> {data.recipientEmail} · <strong>Tipo:</strong> {data.typeLabel}
              </div>
            </div>
            <div className="button-row">
              <Button size="sm" variant={mode === 'html' ? 'primary' : 'secondary'} onClick={() => setMode('html')}>
                Vista diseñada
              </Button>
              <Button size="sm" variant={mode === 'text' ? 'primary' : 'secondary'} onClick={() => setMode('text')}>
                Texto plano
              </Button>
            </div>
          </div>

          {mode === 'html' ? (
            <iframe
              title="Vista previa del correo"
              sandbox=""
              srcDoc={data.html}
              style={{ width: '100%', height: '420px', border: '1px solid var(--border, #d1d5db)', borderRadius: '8px', background: '#f8fafc' }}
            />
          ) : (
            <pre className="pre-wrap" style={{ maxHeight: '420px', overflow: 'auto', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              {data.text}
            </pre>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

export function NotificationRetryModal({
  notification,
  onClose,
}: {
  notification: NotificationItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      setRecipientEmail(notification.recipientEmail);
      setInlineError(notification.lastError);
    } else {
      setInlineError(null);
    }
  }, [notification]);

  const retry = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => notificationsApi.retry(id, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!notification) return;
    const trimmed = recipientEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInlineError('Ingrese una dirección de correo electrónico válida.');
      return;
    }

    setInlineError(null);
    try {
      const updated = await retry.mutateAsync({ id: notification.id, email: trimmed });
      if (updated.status === 'SENT') {
        toast.success(`Correo enviado correctamente a ${updated.recipientEmail}`);
        onClose();
      } else {
        const msg = updated.lastError ?? 'El servicio de correo volvió a rechazar el envío.';
        setInlineError(msg);
        toast.error(msg);
      }
    } catch (e) {
      const msg = getErrorMessage(e);
      setInlineError(msg);
      toast.error(msg);
    }
  };

  return (
    <Modal open={!!notification} title="Reintentar envío de correo" onClose={onClose}>
      {notification && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} noValidate>
          <p>
            Correo <strong>{notification.typeLabel}</strong>
            {notification.workOrderCode ? ` de la orden ${notification.workOrderCode}` : ''}.
          </p>
          {inlineError && <Alert kind="error">{inlineError}</Alert>}
          <Input
            label="Correo destinatario"
            type="email"
            required
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            hint="Si el correo fue rechazado (p. ej. dirección inexistente o no autorizada en el entorno de pruebas), corríjalo aquí para sincronizar al cliente y reintentar."
          />
          <div className="form-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={retry.isPending}>
              Reintentar envío
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
