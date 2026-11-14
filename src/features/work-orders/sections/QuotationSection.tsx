/**
 * Objetivo: registrar cotizaciones, ver su historial y ENVIAR la cotización
 * vigente al cliente por correo con su botón (RF-06).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { WorkOrderDetail } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card } from '../../../components/ui/Feedback';
import { Input, Textarea } from '../../../components/ui/FormField';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { useCreateQuotation, useSendQuotation } from '../hooks';
import { quotationSchema, parseAmountInput, type QuotationFormValues } from '../schemas';

export function QuotationSection({ wo }: { wo: WorkOrderDetail }) {
  const canQuote = useAuthStore((s) => s.hasRole('TECNICO', 'RECEPCIONISTA'));
  const createQuotation = useCreateQuotation(wo.id);
  const sendQuotation = useSendQuotation(wo.id);
  const [confirmSend, setConfirmSend] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<QuotationFormValues | null>(null);
  const latestQuotation = wo.clientVisible.quotations[0];
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuotationFormValues>({ resolver: zodResolver(quotationSchema) });

  const onSubmit = async (values: QuotationFormValues) => {
    try {
      await createQuotation.mutateAsync(values);
      toast.success('Cotización registrada. Use "Enviar cotización" para notificar al cliente.');
      reset();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const send = async () => {
    try {
      await sendQuotation.mutateAsync();
      toast.success(`Correo con la cotización encolado para ${wo.client.email}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setConfirmSend(false);
    }
  };

  return (
    <div className="grid-2">
      <Card title="Nueva cotización">
        {!wo.actions.canCreateQuotation ? (
          <Alert kind="info">Se puede cotizar cuando la orden está "En revisión" (o re-cotizar en "Cotización generada").</Alert>
        ) : !canQuote ? (
          <p className="muted">Su rol no puede registrar cotizaciones.</p>
        ) : (
          <form onSubmit={handleSubmit(setPendingQuote)} noValidate>
            <Input
              label="Valor estimado (USD)"
              type="text"
              inputMode="decimal"
              required
              placeholder="Ej.: 45.50"
              error={errors.amount?.message}
              {...register('amount', { setValueAs: parseAmountInput })}
            />
            <Textarea
              label="Detalle de la reparación"
              required
              rows={4}
              placeholder="Ej.: Cambio de pantalla 15.6 pulgadas FHD + mano de obra. Incluye limpieza interna."
              error={errors.description?.message}
              {...register('description')}
            />
            <Input
              label="Días estimados"
              type="number"
              min="1"
              placeholder="Ej.: 3"
              error={errors.estimatedDays?.message}
              {...register('estimatedDays', { setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)) })}
            />
            <Button type="submit" loading={createQuotation.isPending}>
              Registrar cotización
            </Button>
          </form>
        )}
      </Card>
      <Card title="Cotizaciones">
        {wo.clientVisible.quotations.length === 0 ? (
          <p className="muted">Aún no hay cotizaciones.</p>
        ) : (
          <ul className="quote-list">
            {wo.clientVisible.quotations.map((q, index) => (
              <li key={q.id} className={index === 0 ? 'quote-current' : ''}>
                <div className="quote-head">
                  <strong>{formatMoney(q.amount)}</strong>
                  {index === 0 && <span className="badge badge-orange">Vigente</span>}
                  {q.notifiedAt ? (
                    <span className="badge badge-green">Enviada {formatDateTime(q.notifiedAt)}</span>
                  ) : (
                    <span className="badge badge-gray">No enviada</span>
                  )}
                </div>
                <p className="pre-wrap">{q.description}</p>
                <small className="muted">
                  {q.estimatedDays ? `${q.estimatedDays} día(s) · ` : ''}
                  {q.createdBy?.fullName} · {formatDateTime(q.createdAt)}
                </small>
                {index === 0 && canQuote && (
                  <div className="button-row quote-actions">
                    <Button
                      variant="primary"
                      disabled={!wo.actions.canSendQuotation}
                      title={wo.actions.canSendQuotation ? '' : 'Disponible en estado "Cotización generada"'}
                      onClick={() => setConfirmSend(true)}
                    >
                      {q.notifiedAt ? 'Reenviar cotización' : 'Enviar cotización'}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingQuote}
        title="¿Está seguro de registrar la cotización?"
        confirmLabel="Sí, registrar"
        loading={createQuotation.isPending}
        onCancel={() => setPendingQuote(null)}
        onConfirm={() => pendingQuote && onSubmit(pendingQuote).finally(() => setPendingQuote(null))}
        message={
          <>
            <p>
              Se registrará una cotización de <strong>{formatMoney(pendingQuote?.amount)}</strong>
              {pendingQuote?.estimatedDays ? ` con ${pendingQuote.estimatedDays} día(s) estimados` : ''} y la orden pasará a{' '}
              <strong>Cotización generada</strong>.
            </p>
            <p>El correo al cliente NO se envía todavía: lo enviará después con el botón "Enviar cotización".</p>
          </>
        }
      />

      <ConfirmDialog
        open={confirmSend}
        title="¿Está seguro de enviar la cotización?"
        confirmLabel="Sí, enviar correo"
        loading={sendQuotation.isPending}
        onCancel={() => setConfirmSend(false)}
        onConfirm={send}
        message={
          <p>
            Se enviará un correo a <strong>{wo.client.email}</strong>
            {latestQuotation ? ` con la cotización de ${formatMoney(latestQuotation.amount)} solicitando su aprobación.` : '.'}
          </p>
        }
      />
    </div>
  );
}
