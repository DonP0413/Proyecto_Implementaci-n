/**
 * Objetivo: registro de entrega con la información VISIBLE para el cliente
 * (RF-07) y PDF "listo para entregar" / comprobante de entrega con las
 * políticas de garantía.
 *
 * Flujo en tres pasos, porque la entrega cierra la orden y no se puede deshacer:
 *   1. Editar   : se completan los datos de la entrega.
 *   2. Revisar  : resumen de TODO lo que verá el cliente, con avisos (accesorios
 *                 no devueltos, valor distinto a la cotización) y opción de
 *                 volver a editar o corregir los datos de contacto del cliente.
 *   3. Confirmar: "¿Está seguro?" final antes de registrar.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { clientsApi, workOrderPdfPaths } from '../../../api/endpoints';
import type { WorkOrderDetail } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, DataRow, Spinner } from '../../../components/ui/Feedback';
import { Input, Textarea } from '../../../components/ui/FormField';
import { ConfirmDialog, Modal } from '../../../components/ui/Modal';
import { getErrorMessage } from '../../../lib/errors';
import { emptyToUndefined, formatDateTime, formatMoney } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { ClientForm } from '../../clients/ClientForm';
import { AttachmentGallery } from '../components/AttachmentGallery';
import { FilePicker } from '../components/FilePicker';
import { PdfButton } from '../components/PdfButton';
import { MAX_FILE_MB, STATUS_LABELS } from '../constants';
import { useRegisterDelivery, workOrderKeys } from '../hooks';
import { deliverySchema, parseAmountInput, type DeliveryFormValues } from '../schemas';

type Step = 'edit' | 'review';

export function DeliverySection({ wo }: { wo: WorkOrderDetail }) {
  const canDeliver = useAuthStore((s) => s.hasRole('RECEPCIONISTA'));
  const queryClient = useQueryClient();
  const [photo, setPhoto] = useState<File[]>([]);
  const [step, setStep] = useState<Step>('edit');
  const [values, setValues] = useState<DeliveryFormValues | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const registerDelivery = useRegisterDelivery(wo.id);
  const delivery = wo.clientVisible.delivery;
  const latestQuote = wo.clientVisible.quotations[0];
  const accessories = wo.clientVisible.accessories;

  const fullClient = useQuery({
    queryKey: ['clients', 'detail', wo.client.id],
    queryFn: () => clientsApi.get(wo.client.id),
    enabled: editingClient,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      amountCharged: latestQuote?.amount ?? 0,
      receivedByName: wo.client.fullName,
      receivedByDocument: wo.client.documentId ?? '',
      returnedAccessoryIds: accessories.map((a) => a.id),
    },
  });

  const review = (data: DeliveryFormValues) => {
    setValues(data);
    setStep('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finish = async () => {
    if (!values) return;
    try {
      await registerDelivery.mutateAsync({ data: emptyToUndefined(values), photo: photo[0] });
      toast.success('Entrega registrada. Genere el comprobante de entrega en PDF para el cliente.');
    } catch (e) {
      toast.error(getErrorMessage(e));
      setStep('edit');
    } finally {
      setConfirming(false);
    }
  };

  if (delivery) {
    return (
      <div className="grid-2">
        <Card
          title="Entrega registrada"
          actions={
            <PdfButton size="sm" variant="primary" path={workOrderPdfPaths.ready(wo.id)}>
              Comprobante de entrega (PDF)
            </PdfButton>
          }
        >
          <dl className="data-list">
            <DataRow label="Fecha" value={formatDateTime(delivery.deliveredAt)} />
            <DataRow label="Valor cobrado" value={formatMoney(delivery.amountCharged)} />
            <DataRow label="Retirado por" value={`${delivery.receivedByName} ${delivery.receivedByDocument ?? ''}`} />
            <DataRow label="Entregado por" value={delivery.deliveredBy?.fullName} />
          </dl>
          <h3 className="subheading">Trabajo realizado</h3>
          <p className="pre-wrap">{delivery.workSummary}</p>
          <h3 className="subheading">Condiciones de entrega</h3>
          <p className="pre-wrap">{delivery.returnCondition}</p>
          {delivery.accessoriesNotes && <p className="muted">{delivery.accessoriesNotes}</p>}
        </Card>
        <Card title="Foto de entrega">
          <AttachmentGallery
            attachments={wo.clientVisible.attachments.filter((a) => a.category === 'DELIVERY_PHOTO')}
            emptyText="Sin fotografía de entrega."
          />
        </Card>
      </div>
    );
  }

  if (!wo.actions.canRegisterDelivery) {
    const nextAllowed =
      wo.allowedTransitions && wo.allowedTransitions.length > 0
        ? wo.allowedTransitions.map((t) => `"${t.label}"`).join(' o ')
        : 'completar las etapas previas hasta "Listo para retirar"';
    return (
      <Alert kind="warning">
        No se puede pasar un trabajo en estado <strong>"{STATUS_LABELS[wo.status] ?? wo.status}"</strong> directamente a{' '}
        <strong>"Entregado"</strong>. Siguiente estado permitido: <strong>{nextAllowed}</strong> (la entrega sólo se registra cuando la orden
        está en "Listo para retirar").
      </Alert>
    );
  }
  if (!canDeliver) return <p className="muted">Su rol no puede registrar entregas.</p>;

  const returned = accessories.filter((a) => values?.returnedAccessoryIds.includes(a.id));
  const notReturned = accessories.filter((a) => !values?.returnedAccessoryIds.includes(a.id));
  const amountDiffers = !!values && !!latestQuote && Math.abs(values.amountCharged - latestQuote.amount) > 0.005;

  return (
    <>
      <Alert kind="success">
        <div className="review-head">
          <span>
            <strong>Equipo listo para entregar.</strong> Genere el PDF para el cliente con el servicio, el valor a cancelar y las
            políticas de garantía.
          </span>
          <PdfButton variant="primary" path={workOrderPdfPaths.ready(wo.id)} disabled={!wo.actions.canDownloadReadyPdf}>
            Generar PDF listo para entregar
          </PdfButton>
        </div>
      </Alert>
      <ol className="steps" aria-label="Pasos de la entrega">
        <li className={step === 'edit' ? 'active' : 'done'}>1. Datos de la entrega</li>
        <li className={step === 'review' ? 'active' : ''}>2. Revisar y confirmar</li>
      </ol>

      {step === 'edit' && (
        <Card title="Registrar entrega al cliente">
          <Alert kind="info">
            Esta información es visible para el cliente y aparecerá en el comprobante de entrega (PDF). Antes de finalizar podrá revisarla y corregirla.
          </Alert>
          <form onSubmit={handleSubmit(review)} noValidate className="grid-2">
            <Textarea
              label="Descripción del trabajo realizado"
              required
              rows={4}
              placeholder="Ej.: Se reemplazó la pantalla y se realizó limpieza interna."
              error={errors.workSummary?.message}
              {...register('workSummary')}
            />
            <Textarea
              label="Condiciones en que se devuelve"
              required
              rows={4}
              placeholder="Ej.: Equipo funcional, limpio, sin daños adicionales."
              error={errors.returnCondition?.message}
              {...register('returnCondition')}
            />
            <Input
              label="Valor cobrado (USD)"
              type="text"
              inputMode="decimal"
              required
              placeholder="Ej.: 45.50"
              hint={latestQuote ? `Cotización vigente: ${formatMoney(latestQuote.amount)}` : undefined}
              error={errors.amountCharged?.message}
              {...register('amountCharged', { setValueAs: parseAmountInput })}
            />
            <Input label="Nombre de quien retira" required placeholder="Ej.: María Fernanda Pérez" error={errors.receivedByName?.message} {...register('receivedByName')} />
            <Input label="Documento de quien retira" inputMode="numeric" maxLength={13} placeholder="Ej.: 1718123456" error={errors.receivedByDocument?.message} {...register('receivedByDocument')} />
            <Input label="Notas sobre accesorios" placeholder="Ej.: El cliente se lleva el cargador aparte" error={errors.accessoriesNotes?.message} {...register('accessoriesNotes')} />
            <fieldset className="span-2">
              <legend>Accesorios entregados</legend>
              {accessories.length === 0 && <p className="muted">No se recibieron accesorios.</p>}
              {accessories.map((a) => (
                <label key={a.id} className="checkbox">
                  <input type="checkbox" value={a.id} {...register('returnedAccessoryIds')} /> {a.name} ×{a.quantity}
                </label>
              ))}
            </fieldset>
            <div className="span-2">
              <FilePicker
                label="Fotografía del equipo al entregar (opcional)"
                files={photo}
                onChange={setPhoto}
                accept="image/jpeg,image/png,image/webp"
                maxFiles={1}
                imagesOnly
                hint={`Opcional · Solo archivos de fotografía (JPG, PNG o WEBP) · Peso máximo ${MAX_FILE_MB} MB.`}
              />
            </div>
            <div className="span-2 form-actions">
              <Button type="submit">Revisar entrega</Button>
            </div>
          </form>
        </Card>
      )}

      {step === 'review' && values && (
        <Card title="Revise la entrega antes de finalizar">
          <Alert kind="warning">
            Al finalizar, la orden <strong>{wo.code}</strong> quedará <strong>Entregada</strong> (no se puede reabrir) y este resumen
            aparecerá en el comprobante de entrega (PDF). Verifique que todo esté correcto.
          </Alert>

          <div className="grid-2">
            <section>
              <div className="review-head">
                <h3 className="subheading">Cliente</h3>
                <Button size="sm" variant="ghost" onClick={() => setEditingClient(true)}>
                  Editar datos del cliente
                </Button>
              </div>
              <dl className="data-list">
                <DataRow label="Cliente" value={wo.client.fullName} />
                <DataRow label="Correo" value={wo.client.email} />
                <DataRow label="Teléfono" value={wo.client.phone} />
              </dl>
            </section>
            <section>
              <div className="review-head">
                <h3 className="subheading">Retiro</h3>
              </div>
              <dl className="data-list">
                <DataRow label="Retira" value={`${values.receivedByName}${values.receivedByDocument ? ` · ${values.receivedByDocument}` : ''}`} />
                <DataRow label="Valor cobrado" value={formatMoney(values.amountCharged)} />
                <DataRow label="Foto de entrega" value={photo[0]?.name ?? 'Sin foto'} />
              </dl>
              {amountDiffers && (
                <Alert kind="warning">
                  El valor cobrado es distinto a la cotización vigente ({formatMoney(latestQuote!.amount)}).
                </Alert>
              )}
            </section>
          </div>

          <h3 className="subheading">Trabajo realizado</h3>
          <p className="pre-wrap">{values.workSummary}</p>
          <h3 className="subheading">Condiciones en que se devuelve</h3>
          <p className="pre-wrap">{values.returnCondition}</p>

          <h3 className="subheading">Accesorios</h3>
          {accessories.length === 0 ? (
            <p className="muted">No se recibieron accesorios.</p>
          ) : (
            <ul className="review-list">
              {returned.map((a) => (
                <li key={a.id}>
                  ✔ {a.name} ×{a.quantity}
                </li>
              ))}
              {notReturned.map((a) => (
                <li key={a.id} className="error-text">
                  ✖ {a.name} ×{a.quantity} — NO se devuelve
                </li>
              ))}
            </ul>
          )}
          {values.accessoriesNotes && <p className="muted">{values.accessoriesNotes}</p>}
          {notReturned.length > 0 && (
            <Alert kind="warning">Hay accesorios recibidos que no se marcaron como devueltos. Confirme con el cliente antes de continuar.</Alert>
          )}

          <div className="form-actions">
            <Button variant="secondary" onClick={() => setStep('edit')}>
              ← Editar datos de la entrega
            </Button>
            <Button variant="success" onClick={() => setConfirming(true)}>
              Finalizar entrega
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        title="¿Está seguro de finalizar la entrega?"
        confirmLabel="Sí, finalizar entrega"
        cancelLabel="No, volver a revisar"
        tone="success"
        loading={registerDelivery.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={finish}
        message={
          <>
            <p>
              La orden <strong>{wo.code}</strong> se cerrará como <strong>Entregado</strong> por <strong>{formatMoney(values?.amountCharged)}</strong>.
              Luego podrá generar el comprobante de entrega en PDF.
            </p>
            <p className="error-text">Esta acción no se puede deshacer.</p>
          </>
        }
      />

      <Modal open={editingClient} title="Editar datos del cliente" onClose={() => setEditingClient(false)}>
        {fullClient.isError ? (
          <Alert kind="error">{getErrorMessage(fullClient.error)}</Alert>
        ) : !fullClient.data ? (
          <Spinner />
        ) : (
          <ClientForm
            client={fullClient.data}
            onDone={() => setEditingClient(false)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(wo.id) })}
          />
        )}
      </Modal>
    </>
  );
}
