/**
 * Objetivo: formulario de REGISTRO DE INGRESO (RF-01 y RF-02): cliente
 * (existente o nuevo), equipo con características dinámicas según el tipo,
 * estado de recepción, accesorios y fotografías. Al guardar, el backend
 * genera el comprobante (RF-03) y envía el correo de ingreso (RF-04).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import type { Client } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Spinner } from '../../../components/ui/Feedback';
import { Input, Select, Textarea } from '../../../components/ui/FormField';
import { ConfirmDialog, Modal } from '../../../components/ui/Modal';
import { getErrorMessage } from '../../../lib/errors';
import { toDateTimeInput } from '../../../lib/format';
import { toast } from '../../../stores/toastStore';
import { ClientForm } from '../../clients/ClientForm';
import { ClientPicker } from '../components/ClientPicker';
import { FilePicker } from '../components/FilePicker';
import { TechnicalSpecsFields } from '../components/TechnicalSpecsFields';
import { COMMON_ACCESSORIES, MAX_FILE_MB, MAX_PHOTOS, PHYSICAL_CONDITION_OPTIONS, POWER_STATUS_OPTIONS } from '../constants';
import { useCreateWorkOrder, useEquipmentTypes, useEquipmentsBySerial, useTechnicians } from '../hooks';
import { newWorkOrderSchema, toCreateWorkOrderRequest, type NewWorkOrderFormValues } from '../schemas';

const DEFAULTS: NewWorkOrderFormValues = {
  receivedAt: '',
  clientMode: 'existing',
  clientId: '',
  client: { fullName: '', documentId: '', email: '', phone: '', address: '' },
  equipment: {
    equipmentTypeId: Number.NaN,
    brand: '',
    model: '',
    serialNumber: '',
    technicalSpecs: {},
    forceNewEquipment: false,
  },
  extraSpecs: [],
  reportedIssue: '',
  reception: { powerStatus: 'SI', physicalCondition: 'BUENO', visibleDamage: '', functionalNotes: '' },
  accessories: [],
  assignedTechnicianId: '',
  estimatedDeliveryDate: '',
};

export function NewWorkOrderPage() {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: types, isLoading: loadingTypes } = useEquipmentTypes();
  const { data: technicians } = useTechnicians();
  const createWorkOrder = useCreateWorkOrder();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewWorkOrderFormValues>({
    resolver: zodResolver(newWorkOrderSchema),
    // La fecha de ingreso se propone con el momento actual; recepción puede corregirla.
    defaultValues: { ...DEFAULTS, receivedAt: toDateTimeInput() },
  });
  const accessories = useFieldArray({ control, name: 'accessories' });

  const clientMode = watch('clientMode');
  const typeId = watch('equipment.equipmentTypeId');
  const serialNumber = watch('equipment.serialNumber') ?? '';
  const [debouncedSerial, setDebouncedSerial] = useState('');
  const selectedType = useMemo(() => types?.find((t) => t.id === typeId), [types, typeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSerial(serialNumber.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [serialNumber]);

  // Si cambia el número de serie ingresado, reinicia la marca de equipo repetido.
  useEffect(() => {
    setValue('equipment.forceNewEquipment', false);
  }, [serialNumber, setValue]);

  const { data: serialMatches } = useEquipmentsBySerial(debouncedSerial);
  const exactSerialMatches = useMemo(() => {
    const target = debouncedSerial.trim().toLowerCase();
    if (target.length < 2 || !serialMatches) return [];
    return serialMatches.filter((eq) => (eq.serialNumber ?? '').trim().toLowerCase() === target);
  }, [debouncedSerial, serialMatches]);

  // Al cambiar el tipo de equipo se descartan las características del tipo anterior
  // (sus campos ya no se ven y podrían no ser válidos para el nuevo tipo).
  useEffect(() => {
    setValue('equipment.technicalSpecs', {});
  }, [typeId, setValue]);

  // Paso de confirmación: el registro genera el comprobante y envía un correo automático.
  const [pendingValues, setPendingValues] = useState<NewWorkOrderFormValues | null>(null);
  const recipient = pendingValues?.clientMode === 'new' ? pendingValues.client?.email : selectedClient?.email;
  const missingExistingDocument = clientMode === 'existing' && !!selectedClient && !selectedClient.documentId;

  const onValidSubmit = (values: NewWorkOrderFormValues) => {
    if (values.clientMode === 'existing' && selectedClient && !selectedClient.documentId) {
      setSubmitError('El cliente seleccionado no tiene cédula / RUC registrado. Complete su documento antes de continuar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitError(null);
    setPendingValues(values);
  };

  const onSubmit = async (values: NewWorkOrderFormValues) => {
    setSubmitError(null);
    try {
      const created = await createWorkOrder.mutateAsync({ data: toCreateWorkOrderRequest(values), photos });
      toast.success(`Orden ${created.code} registrada. Se enviará el correo de confirmación al cliente.`);
      navigate(`/work-orders/${created.id}`, { state: { justCreated: true } });
    } catch (e) {
      setSubmitError(getErrorMessage(e));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loadingTypes) return <Spinner />;

  return (
    <form className="page" onSubmit={handleSubmit(onValidSubmit)} noValidate>
      <div className="page-header">
        <h1>Registrar ingreso de equipo</h1>
      </div>
      {submitError && <Alert kind="error">{submitError}</Alert>}

      <Card title="1. Cliente">
        <div className="grid-3">
          <Input
            label="Fecha y hora de ingreso"
            type="datetime-local"
            required
            max={toDateTimeInput()}
            hint="Ajústela si el equipo se recibió antes de registrarlo"
            error={errors.receivedAt?.message}
            {...register('receivedAt')}
          />
        </div>
        <div className="segmented" role="radiogroup" aria-label="Tipo de cliente">
          <label className={clientMode === 'existing' ? 'active' : ''}>
            <input type="radio" value="existing" {...register('clientMode')} /> Cliente existente
          </label>
          <label className={clientMode === 'new' ? 'active' : ''}>
            <input type="radio" value="new" {...register('clientMode')} /> Cliente nuevo
          </label>
        </div>
        {clientMode === 'existing' ? (
          <>
            <ClientPicker
              selected={selectedClient}
              error={errors.clientId?.message}
              onSelect={(client) => {
                setSelectedClient(client);
                setValue('clientId', client?.id ?? '', { shouldValidate: !!client });
              }}
            />
            {missingExistingDocument && (
              <Alert kind="warning">
                <div>
                  <strong>Cédula / RUC faltante.</strong> El cliente seleccionado no tiene cédula o RUC registrado y es obligatorio para registrar un ingreso.{' '}
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditingClient(true)}>
                    Completar cédula / RUC
                  </Button>
                </div>
              </Alert>
            )}
          </>
        ) : (
          <div className="grid-3">
            <Input label="Nombre completo" required placeholder="Ej.: María Fernanda Pérez" error={errors.client?.fullName?.message} {...register('client.fullName')} />
            <Input label="Cédula / RUC" required placeholder="Ej.: 1718123456" error={errors.client?.documentId?.message} {...register('client.documentId')} />
            <Input label="Correo electrónico" type="email" required placeholder="Ej.: maria.perez@gmail.com" hint="Aquí se enviarán las notificaciones" error={errors.client?.email?.message} {...register('client.email')} />
            <Input label="Teléfono" type="tel" placeholder="Ej.: 0991234567" error={errors.client?.phone?.message} {...register('client.phone')} />
            <Input label="Dirección" placeholder="Ej.: Av. Amazonas N34-12 y Naciones Unidas" error={errors.client?.address?.message} {...register('client.address')} />
          </div>
        )}
      </Card>

      <Card title="2. Equipo">
        <div className="grid-3">
          <Select
            label="Tipo de equipo"
            required
            placeholder="Seleccione…"
            options={(types ?? []).map((t) => ({ value: t.id, label: t.name }))}
            error={errors.equipment?.equipmentTypeId?.message}
            {...register('equipment.equipmentTypeId', { valueAsNumber: true })}
          />
          <Input label="Marca" required placeholder="Ej.: HP, Lenovo, Creality" error={errors.equipment?.brand?.message} {...register('equipment.brand')} />
          <Input label="Modelo" required placeholder="Ej.: Pavilion 15-eg0xxx" error={errors.equipment?.model?.message} {...register('equipment.model')} />
          <Input label="Número de serie" required placeholder="Ej.: 5CD1234XYZ (etiqueta inferior)" hint="Obligatorio · permite consultar el historial del equipo" error={errors.equipment?.serialNumber?.message} {...register('equipment.serialNumber')} />
        </div>
        {exactSerialMatches.length > 0 && (
          <Alert kind="warning">
            <p style={{ marginTop: 0 }}>
              <strong>Número de serie ya registrado.</strong> Se encontró {exactSerialMatches.length} equipo(s) con el número de serie{' '}
              <code>{debouncedSerial}</code>:
            </p>
            <ul className="plain-list" style={{ marginBottom: '0.5rem' }}>
              {exactSerialMatches.map((eq) => (
                <li key={eq.id}>
                  <strong>{eq.equipmentType.name}</strong> {eq.brand} {eq.model}
                  {eq.client ? ` · Cliente: ${eq.client.fullName}${eq.client.documentId ? ` (${eq.client.documentId})` : ''}` : ''} ·{' '}
                  <Link to={`/work-orders?equipmentId=${eq.id}`} target="_blank" rel="noopener noreferrer">
                    Ver trabajos de este equipo
                  </Link>
                </li>
              ))}
            </ul>
            <p className="small" style={{ margin: '0.25rem 0' }}>
              Si es el <strong>mismo equipo</strong> del mismo cliente, deje la casilla sin marcar para continuar su historial. Si se trata de{' '}
              <strong>otro equipo físico</strong> con serie repetida (error de fábrica o reacondicionado), márquela para crear un historial independiente.
            </p>
            <label className="checkbox" style={{ marginTop: '0.35rem' }}>
              <input type="checkbox" {...register('equipment.forceNewEquipment')} />
              Es un equipo distinto con número de serie repetido (error de fábrica o reacondicionado) — crear historial independiente
            </label>
          </Alert>
        )}
        {selectedType && <TechnicalSpecsFields type={selectedType} register={register} control={control} errors={errors} />}
        <Textarea
          label="Falla reportada por el cliente"
          required
          rows={3}
          placeholder="Con las palabras del cliente: qué pasa, desde cuándo y si hubo golpes, líquidos o reparaciones previas"
          error={errors.reportedIssue?.message} {...register('reportedIssue')} />
      </Card>

      <Card title="3. Estado de recepción">
        <div className="grid-3">
          <Select label="¿Enciende?" required options={POWER_STATUS_OPTIONS} error={errors.reception?.powerStatus?.message} {...register('reception.powerStatus')} />
          <Select label="Estado físico" required options={PHYSICAL_CONDITION_OPTIONS} error={errors.reception?.physicalCondition?.message} {...register('reception.physicalCondition')} />
        </div>
        <div className="grid-2">
          <Textarea label="Daños visibles" placeholder="Rayones, golpes, piezas faltantes…" error={errors.reception?.visibleDamage?.message} {...register('reception.visibleDamage')} />
          <Textarea label="Observaciones funcionales" placeholder="Enciende pero no da imagen, teclas que no responden…" error={errors.reception?.functionalNotes?.message} {...register('reception.functionalNotes')} />
        </div>

        <h3 className="subheading">Accesorios recibidos</h3>
        <div className="chips">
          {COMMON_ACCESSORIES.map((name) => (
            <button key={name} type="button" className="chip" onClick={() => accessories.append({ name, quantity: 1, notes: '' })}>
              + {name}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => accessories.append({ name: '', quantity: 1, notes: '' })}>
            + Otro
          </button>
        </div>
        {accessories.fields.length > 0 && (
          <table className="table accessories-table">
            <thead>
              <tr>
                <th>Accesorio</th>
                <th style={{ width: 90 }}>Cant.</th>
                <th>Notas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accessories.fields.map((field, index) => (
                <tr key={field.id}>
                  <td>
                    <input aria-label="Nombre del accesorio" placeholder="Ej.: Cargador original" {...register(`accessories.${index}.name`)} />
                    {errors.accessories?.[index]?.name && <small className="error-text">{errors.accessories[index]?.name?.message}</small>}
                  </td>
                  <td>
                    <input aria-label="Cantidad" type="number" min={1} max={99} {...register(`accessories.${index}.quantity`, { valueAsNumber: true })} />
                  </td>
                  <td>
                    <input aria-label="Notas del accesorio" placeholder="Ej.: cable pelado, sin funda" {...register(`accessories.${index}.notes`)} />
                  </td>
                  <td>
                    <button type="button" className="icon-btn" aria-label="Quitar accesorio" onClick={() => accessories.remove(index)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <FilePicker
          label="Fotografías del equipo (opcional, respaldo)"
          files={photos}
          onChange={setPhotos}
          accept="image/jpeg,image/png,image/webp"
          maxFiles={MAX_PHOTOS}
          imagesOnly
          hint={`Opcional · Solo archivos de fotografía (JPG, PNG o WEBP) · Hasta ${MAX_PHOTOS} fotos de máximo ${MAX_FILE_MB} MB cada una. La primera se incluye en el comprobante.`}
        />
      </Card>

      <Card title="4. Asignación (opcional)">
        <div className="grid-3">
          <Select
            label="Técnico responsable"
            placeholder="Sin asignar"
            options={(technicians ?? []).map((t) => ({ value: t.id, label: t.fullName }))}
            {...register('assignedTechnicianId')}
          />
          <Input label="Fecha estimada de entrega" type="date" hint="Fecha que se comunica al cliente" {...register('estimatedDeliveryDate')} />
        </div>
      </Card>

      <div className="form-actions">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" loading={createWorkOrder.isPending}>
          Registrar ingreso y generar comprobante
        </Button>
      </div>

      <ConfirmDialog
        open={!!pendingValues}
        title="¿Está seguro de registrar el ingreso?"
        confirmLabel="Sí, registrar ingreso"
        cancelLabel="No, seguir editando"
        loading={createWorkOrder.isPending}
        onCancel={() => setPendingValues(null)}
        onConfirm={() => pendingValues && onSubmit(pendingValues).finally(() => setPendingValues(null))}
        message={
          <>
            <p>
              Se generará el <strong>comprobante de ingreso</strong> con un ID de trabajo único y se enviará automáticamente a{' '}
              <strong>{recipient ?? 'el cliente'}</strong>.
            </p>
            <p>Revise que el correo del cliente, el equipo y el estado de recepción sean correctos. Sólo podrá corregir estos datos mientras la orden permanezca en estado Ingresado.</p>
          </>
        }
      />

      <Modal open={editingClient && !!selectedClient} title="Completar datos del cliente" onClose={() => setEditingClient(false)}>
        {selectedClient && (
          <ClientForm
            client={selectedClient}
            onDone={() => setEditingClient(false)}
            onSaved={(saved) => setSelectedClient(saved)}
          />
        )}
      </Modal>
    </form>
  );
}
