/** Objetivo: datos del ingreso: cliente, equipo, características, estado de recepción y accesorios. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { workOrderPdfPaths } from '../../../api/endpoints';
import {
  EXTRA_SPEC_PREFIX,
  MAX_EXTRA_SPECS,
  type EquipmentType,
  type SpecField,
  type WorkOrderDetail,
} from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, DataRow } from '../../../components/ui/Feedback';
import { Input, Select, Textarea } from '../../../components/ui/FormField';
import { Modal } from '../../../components/ui/Modal';
import { getErrorMessage } from '../../../lib/errors';
import { formatDate, formatDateTime } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { StatusBadge } from '../components/StatusBadge';
import { AttachmentGallery } from '../components/AttachmentGallery';
import { PdfButton } from '../components/PdfButton';
import { fieldLabel, groupFields } from '../components/TechnicalSpecsFields';
import { PHYSICAL_CONDITION_OPTIONS, POWER_STATUS_OPTIONS } from '../constants';
import { useEquipmentTypes, useUpdateIntake, useWorkOrders } from '../hooks';
import { toUpdateIntakeRequest, updateIntakeSchema, type UpdateIntakeFormValues } from '../schemas';

const buildInitialIntakeValues = (wo: WorkOrderDetail, types?: EquipmentType[]): UpdateIntakeFormValues => {
  const rawSpecs = wo.clientVisible.rawSpecs ?? {};
  const technicalSpecs: Record<string, string> = {};
  const extraSpecs: Array<{ name: string; value: string }> = [];
  for (const [k, v] of Object.entries(rawSpecs)) {
    if (k.startsWith(EXTRA_SPEC_PREFIX)) {
      extraSpecs.push({ name: k.slice(EXTRA_SPEC_PREFIX.length), value: String(v) });
    } else {
      technicalSpecs[k] = String(v);
    }
  }
  const fallbackTypeId = types?.find((t) => t.name === wo.equipment.typeName)?.id ?? 0;
  return {
    client: {
      fullName: wo.client.fullName,
      documentId: wo.client.documentId ?? '',
      email: wo.client.email,
      phone: wo.client.phone ?? '',
      address: wo.client.address ?? '',
    },
    equipment: {
      equipmentTypeId: wo.equipment.equipmentTypeId ?? fallbackTypeId,
      brand: wo.equipment.brand,
      model: wo.equipment.model,
      serialNumber: wo.equipment.serialNumber ?? '',
      technicalSpecs,
    },
    extraSpecs,
    reportedIssue: wo.clientVisible.reportedIssue,
    reception: {
      powerStatus: wo.clientVisible.reception?.powerStatus ?? 'SI',
      physicalCondition: wo.clientVisible.reception?.physicalCondition ?? 'BUENO',
      visibleDamage: wo.clientVisible.reception?.visibleDamage ?? '',
      functionalNotes: wo.clientVisible.reception?.functionalNotes ?? '',
    },
    estimatedDeliveryDate: wo.estimatedDeliveryDate ?? '',
  };
};

function EditIntakeModal({ wo, onClose }: { wo: WorkOrderDetail; onClose: () => void }) {
  const { data: types } = useEquipmentTypes();
  const updateIntake = useUpdateIntake(wo.id);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initialValues = useMemo(() => buildInitialIntakeValues(wo, types), [wo, types]);
  const prevTypeIdRef = useRef(initialValues.equipment.equipmentTypeId);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UpdateIntakeFormValues>({
    resolver: zodResolver(updateIntakeSchema),
    defaultValues: initialValues,
  });

  const extras = useFieldArray({ control, name: 'extraSpecs' });
  const typeId = watch('equipment.equipmentTypeId');
  const selectedType = useMemo(() => types?.find((t) => t.id === typeId), [types, typeId]);

  useEffect(() => {
    if (prevTypeIdRef.current !== typeId) {
      prevTypeIdRef.current = typeId;
      setValue('equipment.technicalSpecs', {});
    }
  }, [typeId, setValue]);

  const specErrors = errors.equipment?.technicalSpecs as Record<string, { message?: string }> | undefined;
  const renderSpecField = (field: SpecField) => {
    const common = {
      label: fieldLabel(field),
      placeholder: field.placeholder,
      hint: field.hint,
      error: specErrors?.[field.key]?.message,
      ...register(`equipment.technicalSpecs.${field.key}`),
    };
    switch (field.type) {
      case 'select':
        return <Select key={field.key} {...common} placeholder="No indicado" options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />;
      case 'textarea':
        return <Textarea key={field.key} {...common} />;
      case 'number':
        return <Input key={field.key} {...common} type="number" inputMode="decimal" step="any" min={field.min} max={field.max} />;
      default:
        return <Input key={field.key} {...common} />;
    }
  };

  const onSubmit = async (values: UpdateIntakeFormValues) => {
    setSubmitError(null);
    try {
      await updateIntake.mutateAsync(toUpdateIntakeRequest(values));
      toast.success('Datos de ingreso corregidos y comprobante regenerado');
      onClose();
    } catch (e) {
      setSubmitError(getErrorMessage(e));
    }
  };

  return (
    <Modal open size="lg" title={`Corregir datos de ingreso — ${wo.code}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {submitError && <Alert kind="error">{submitError}</Alert>}
        <Alert kind="info">
          Esta corrección sólo está disponible mientras la orden está en estado <strong>Ingresado</strong>. El comprobante PDF se regenerará y el cambio quedará registrado en el historial.
        </Alert>

        <h3 className="subheading">1. Datos del cliente</h3>
        <div className="grid-2">
          <Input label="Nombre completo" required error={errors.client?.fullName?.message} {...register('client.fullName')} />
          <Input label="Cédula / RUC" required inputMode="numeric" maxLength={13} error={errors.client?.documentId?.message} {...register('client.documentId')} />
          <Input label="Correo electrónico" type="email" required error={errors.client?.email?.message} {...register('client.email')} />
          <Input label="Teléfono" type="tel" error={errors.client?.phone?.message} {...register('client.phone')} />
          <Input label="Dirección" error={errors.client?.address?.message} {...register('client.address')} />
          <Input label="Fecha estimada de entrega" type="date" error={errors.estimatedDeliveryDate?.message} {...register('estimatedDeliveryDate')} />
        </div>

        <h3 className="subheading">2. Datos del equipo</h3>
        <div className="grid-2">
          <Select
            label="Tipo de equipo"
            required
            placeholder="Seleccione…"
            options={(types ?? []).map((t) => ({ value: t.id, label: t.name }))}
            error={errors.equipment?.equipmentTypeId?.message}
            {...register('equipment.equipmentTypeId', { valueAsNumber: true })}
          />
          <Input label="Marca" required error={errors.equipment?.brand?.message} {...register('equipment.brand')} />
          <Input label="Modelo" required error={errors.equipment?.model?.message} {...register('equipment.model')} />
          <Input label="Número de serie" required error={errors.equipment?.serialNumber?.message} {...register('equipment.serialNumber')} />
        </div>

        {selectedType && (
          <>
            <h3 className="subheading">Características técnicas ({selectedType.name})</h3>
            {groupFields(selectedType.specSchema.filter((f) => !f.legacy)).map(([group, fields]) => (
              <fieldset key={group || 'general'} className="spec-group">
                {group && <legend>{group}</legend>}
                <div className="grid-3">{fields.map(renderSpecField)}</div>
              </fieldset>
            ))}
            <fieldset className="spec-group">
              <legend>Especificaciones adicionales</legend>
              {extras.fields.map((item, index) => (
                <div className="extra-spec-row" key={item.id}>
                  <Input
                    label="Especificación"
                    error={errors.extraSpecs?.[index]?.name?.message}
                    {...register(`extraSpecs.${index}.name`)}
                  />
                  <Input
                    label="Valor"
                    error={errors.extraSpecs?.[index]?.value?.message}
                    {...register(`extraSpecs.${index}.value`)}
                  />
                  <button type="button" className="icon-btn" aria-label="Quitar especificación" onClick={() => extras.remove(index)}>
                    ×
                  </button>
                </div>
              ))}
              {extras.fields.length < MAX_EXTRA_SPECS && (
                <button type="button" className="chip" onClick={() => extras.append({ name: '', value: '' })}>
                  + Agregar especificación
                </button>
              )}
            </fieldset>
          </>
        )}

        <h3 className="subheading">3. Falla reportada y recepción</h3>
        <Textarea label="Falla reportada por el cliente" required rows={3} error={errors.reportedIssue?.message} {...register('reportedIssue')} />
        <div className="grid-2">
          <Select label="¿Enciende?" required options={POWER_STATUS_OPTIONS} error={errors.reception?.powerStatus?.message} {...register('reception.powerStatus')} />
          <Select label="Estado físico" required options={PHYSICAL_CONDITION_OPTIONS} error={errors.reception?.physicalCondition?.message} {...register('reception.physicalCondition')} />
          <Textarea label="Daños visibles" error={errors.reception?.visibleDamage?.message} {...register('reception.visibleDamage')} />
          <Textarea label="Observaciones funcionales" error={errors.reception?.functionalNotes?.message} {...register('reception.functionalNotes')} />
        </div>

        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={updateIntake.isPending}>
            Guardar corrección
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ReceptionSection({ wo }: { wo: WorkOrderDetail }) {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canEditIntake = (wo.actions.canEditIntake ?? wo.status === 'INGRESADO') && hasRole('RECEPCIONISTA', 'TECNICO');
  const [editing, setEditing] = useState(false);
  const { reception, accessories, specs, reportedIssue, attachments } = wo.clientVisible;
  const photos = attachments.filter((a) => a.category === 'RECEPTION_PHOTO');
  const { data: equipmentHistory } = useWorkOrders({ equipmentId: wo.equipment.id, page: 1, limit: 20 });
  const relatedOrders = equipmentHistory?.items ?? [];

  return (
    <div className="grid-2">
      <div className="span-2">
        <Alert kind="info">
          <div className="review-head">
            <span>
              <strong>PDF de ingreso:</strong> comprobante con los datos del cliente, el equipo, el estado de recepción y las políticas
              de garantía, para imprimir y entregar al cliente.
            </span>
            <PdfButton variant="primary" path={workOrderPdfPaths.reception(wo.id)}>
              Generar PDF de ingreso
            </PdfButton>
          </div>
        </Alert>
      </div>
      {canEditIntake && (
        <div className="span-2">
          <Alert kind="info">
            <div className="review-head">
              <span>Puede corregir los datos del ingreso mientras la orden esté en estado Ingresado.</span>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Corregir datos de ingreso
              </Button>
            </div>
          </Alert>
        </div>
      )}
      <Card title="Cliente">
        <dl className="data-list">
          <DataRow label="Nombre" value={wo.client.fullName} />
          <DataRow label="Documento" value={wo.client.documentId} />
          <DataRow label="Correo" value={wo.client.email} />
          <DataRow label="Teléfono" value={wo.client.phone} />
          <DataRow label="Dirección" value={wo.client.address} />
        </dl>
      </Card>
      <Card title="Equipo">
        <dl className="data-list">
          <DataRow label="Tipo" value={wo.equipment.typeName} />
          <DataRow label="Marca / Modelo" value={`${wo.equipment.brand} ${wo.equipment.model}`} />
          <DataRow
            label="N.º de serie"
            value={
              wo.equipment.serialNumber ? (
                <>
                  {wo.equipment.serialNumber}{' '}
                  <Link to={`/work-orders?equipmentId=${wo.equipment.id}`} className="small">
                    Ver historial de este equipo
                  </Link>
                </>
              ) : (
                null
              )
            }
          />
          {specs.map((spec) => (
            <DataRow key={spec.key} label={spec.label} value={spec.value} />
          ))}
        </dl>
      </Card>
      <Card title="Falla reportada y estado de recepción">
        <p className="pre-wrap">{reportedIssue}</p>
        {reception && (
          <dl className="data-list">
            <DataRow label="¿Enciende?" value={reception.powerStatusLabel} />
            <DataRow label="Estado físico" value={reception.physicalConditionLabel} />
            <DataRow label="Daños visibles" value={reception.visibleDamage} />
            <DataRow label="Observaciones" value={reception.functionalNotes} />
          </dl>
        )}
        <dl className="data-list">
          <DataRow label="Recibido" value={`${formatDateTime(wo.receivedAt)} por ${wo.receivedBy?.fullName ?? '—'}`} />
          <DataRow label="Entrega estimada" value={formatDate(wo.estimatedDeliveryDate)} />
        </dl>
      </Card>
      <Card title={`Accesorios recibidos (${accessories.length})`}>
        {accessories.length === 0 ? (
          <p className="muted">Sin accesorios.</p>
        ) : (
          <ul className="plain-list">
            {accessories.map((a) => (
              <li key={a.id}>
                {a.name} ×{a.quantity} {a.notes && <span className="muted">— {a.notes}</span>}
                {a.returned && <span className="badge badge-teal">Devuelto</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Fotografías de recepción" className="span-2">
        <AttachmentGallery attachments={photos} emptyText="No se registraron fotografías al ingreso." />
      </Card>
      {relatedOrders.length > 1 && (
        <Card title={`Historial de reparaciones de este equipo (${equipmentHistory?.meta.total ?? relatedOrders.length})`} className="span-2">
          <table className="table">
            <thead>
              <tr>
                <th>ID de trabajo</th>
                <th>Fecha de ingreso</th>
                <th>Estado</th>
                <th>Técnico / Entrega</th>
              </tr>
            </thead>
            <tbody>
              {relatedOrders.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/work-orders/${item.id}`} className="code">
                      {item.code}
                    </Link>
                    {item.id === wo.id && <span className="muted small"> (actual)</span>}
                  </td>
                  <td>{formatDateTime(item.receivedAt)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {item.deliveredAt
                      ? `Entregado ${formatDateTime(item.deliveredAt)}`
                      : (item.assignedTechnician?.fullName ?? 'Sin asignar')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {editing && <EditIntakeModal wo={wo} onClose={() => setEditing(false)} />}
    </div>
  );
}
