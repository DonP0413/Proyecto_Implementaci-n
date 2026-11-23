/**
 * Objetivo: esquemas Zod de los formularios (validación en el cliente con
 * las mismas reglas que el backend, para dar feedback inmediato) y
 * funciones que transforman el formulario al contrato de la API.
 */
import { z } from 'zod';
import {
  EXTRA_SPEC_PREFIX,
  MAX_EXTRA_SPECS,
  type CreateWorkOrderRequest,
  type UpdateWorkOrderIntakeRequest,
} from '../../api/types';
import { toDateInput } from '../../lib/format';
import {
  BRAND_MODEL_MESSAGE,
  BRAND_MODEL_RULE,
  CLIENT_NAME_MESSAGE,
  CLIENT_NAME_RULE,
  documentIdField,
  optionalDocumentIdField,
  optionalPhoneField,
  personNameField,
  SERIAL_MESSAGE,
  SERIAL_RULE,
} from '../../lib/validation';

const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional();

/** Margen para relojes desincronizados (igual que el backend). */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Fecha de ingreso del cliente: AAAA-MM-DD, no futura. */
export const registeredAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indique la fecha de ingreso')
  .refine((value) => value <= toDateInput(), 'La fecha de ingreso no puede ser futura');

/** Fecha y hora de ingreso del equipo (valor de datetime-local), no futura. */
export const receivedAtSchema = z
  .string()
  .min(1, 'Indique la fecha de ingreso')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Fecha de ingreso inválida')
  .refine((value) => new Date(value).getTime() <= Date.now() + CLOCK_SKEW_MS, 'La fecha de ingreso no puede ser futura');

export const clientSchema = z.object({
  fullName: z.string().trim().min(3, 'Ingrese el nombre completo').max(150).regex(CLIENT_NAME_RULE, CLIENT_NAME_MESSAGE),
  documentId: documentIdField,
  email: z.string().trim().email('Correo inválido: es el contacto del cliente que aparece en los PDF'),
  phone: optionalPhoneField,
  address: optionalText(250),
  registeredAt: registeredAtSchema.optional(),
});
export type ClientFormValues = z.infer<typeof clientSchema>;

const equipmentSchema = z.object({
  equipmentTypeId: z.number({ invalid_type_error: 'Seleccione el tipo de equipo' }).int().positive('Seleccione el tipo de equipo'),
  brand: z.string().trim().min(1, 'Ingrese la marca').max(60).regex(BRAND_MODEL_RULE, `Marca: ${BRAND_MODEL_MESSAGE}`),
  model: z.string().trim().min(1, 'Ingrese el modelo').max(80).regex(BRAND_MODEL_RULE, `Modelo: ${BRAND_MODEL_MESSAGE}`),
  serialNumber: z
    .string()
    .trim()
    .min(1, 'Ingrese el número de serie')
    .max(80, 'Máximo 80 caracteres')
    .regex(SERIAL_RULE, SERIAL_MESSAGE),
  technicalSpecs: z.record(z.string()),
  forceNewEquipment: z.boolean().optional(),
});

const extraSpecsSchema = z
  .array(
    z.object({
      name: z.string().trim().max(40, 'Máximo 40 caracteres'),
      value: z.string().trim().max(500, 'Máximo 500 caracteres'),
    }),
  )
  .max(MAX_EXTRA_SPECS, `Máximo ${MAX_EXTRA_SPECS} especificaciones adicionales`);

const receptionSchema = z.object({
  powerStatus: z.enum(['SI', 'NO', 'NO_PROBADO'], { errorMap: () => ({ message: 'Indique si enciende' }) }),
  physicalCondition: z.enum(['BUENO', 'REGULAR', 'MALO'], { errorMap: () => ({ message: 'Indique el estado físico' }) }),
  visibleDamage: optionalText(2000),
  functionalNotes: optionalText(2000),
});

const validateExtraSpecs = (
  extraSpecs: Array<{ name: string; value: string }>,
  ctx: z.RefinementCtx,
) => {
  extraSpecs.forEach((extra, index) => {
    if (extra.name && !extra.value) ctx.addIssue({ code: 'custom', path: ['extraSpecs', index, 'value'], message: 'Indique el valor' });
    if (extra.value && !extra.name) ctx.addIssue({ code: 'custom', path: ['extraSpecs', index, 'name'], message: 'Indique qué especificación es' });
  });
};

export const newWorkOrderSchema = z
  .object({
    receivedAt: receivedAtSchema,
    clientMode: z.enum(['existing', 'new']),
    clientId: z.string().optional(),
    client: z
      .object({
        fullName: z.string().optional(),
        documentId: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),
    equipment: equipmentSchema,
    extraSpecs: extraSpecsSchema,
    reportedIssue: z.string().trim().min(3, 'Describa la falla reportada').max(2000),
    reception: receptionSchema,
    accessories: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Nombre requerido').max(80),
          quantity: z.number({ invalid_type_error: 'Cantidad' }).int().min(1).max(99),
          notes: optionalText(200),
        }),
      )
      .max(20, 'Máximo 20 accesorios'),
    assignedTechnicianId: z.string().optional(),
    estimatedDeliveryDate: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    validateExtraSpecs(values.extraSpecs, ctx);
    // La entrega estimada no puede ser anterior al día de ingreso.
    const receivedDay = values.receivedAt?.slice(0, 10);
    if (values.estimatedDeliveryDate && receivedDay && values.estimatedDeliveryDate < receivedDay) {
      ctx.addIssue({
        code: 'custom',
        path: ['estimatedDeliveryDate'],
        message: 'La fecha estimada de entrega no puede ser anterior a la fecha de ingreso',
      });
    }
    if (values.clientMode === 'existing') {
      if (!values.clientId) ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'Seleccione un cliente' });
      return;
    }
    const parsed = clientSchema.safeParse(values.client ?? {});
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ['client', ...issue.path] }));
    }
  });
export type NewWorkOrderFormValues = z.infer<typeof newWorkOrderSchema>;

export const updateIntakeSchema = z
  .object({
    client: clientSchema.omit({ registeredAt: true }),
    equipment: equipmentSchema.omit({ forceNewEquipment: true }),
    extraSpecs: extraSpecsSchema,
    reportedIssue: z.string().trim().min(3, 'Describa la falla reportada').max(2000),
    reception: receptionSchema,
    estimatedDeliveryDate: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    validateExtraSpecs(values.extraSpecs, ctx);
  });
export type UpdateIntakeFormValues = z.infer<typeof updateIntakeSchema>;

const blank = (value?: string) => (value && value.trim() !== '' ? value.trim() : undefined);

const buildSpecsRecord = (
  technicalSpecs: Record<string, string> | undefined,
  extraSpecs: Array<{ name: string; value: string }>,
): Record<string, string> => {
  const specs: Record<string, string> = Object.fromEntries(
    Object.entries(technicalSpecs ?? {})
      .filter(([, v]) => v && String(v).trim() !== '')
      .map(([k, v]) => [k, String(v).trim()]),
  );
  // Especificaciones adicionales libres: viajan en el mismo objeto con prefijo.
  extraSpecs.forEach(({ name, value }) => {
    if (name.trim() && value.trim()) specs[`${EXTRA_SPEC_PREFIX}${name.trim()}`] = value.trim();
  });
  return specs;
};

export const toCreateWorkOrderRequest = (values: NewWorkOrderFormValues): CreateWorkOrderRequest => {
  const receivedAt = new Date(values.receivedAt);
  const specs = buildSpecsRecord(values.equipment.technicalSpecs, values.extraSpecs);
  return {
    ...(values.clientMode === 'existing'
      ? { clientId: values.clientId }
      : {
          client: {
            fullName: values.client!.fullName!.trim(),
            email: values.client!.email!.trim(),
            documentId: values.client!.documentId!.trim(),
            phone: blank(values.client?.phone),
            address: blank(values.client?.address),
            // El cliente nuevo ingresa el mismo día que su equipo.
            registeredAt: toDateInput(receivedAt),
          },
        }),
    equipment: {
      equipmentTypeId: values.equipment.equipmentTypeId,
      brand: values.equipment.brand.trim(),
      model: values.equipment.model.trim(),
      serialNumber: values.equipment.serialNumber.trim(),
      technicalSpecs: specs,
      ...(values.equipment.forceNewEquipment ? { forceNewEquipment: true } : {}),
    },
    reportedIssue: values.reportedIssue.trim(),
    reception: {
      powerStatus: values.reception.powerStatus,
      physicalCondition: values.reception.physicalCondition,
      visibleDamage: blank(values.reception.visibleDamage),
      functionalNotes: blank(values.reception.functionalNotes),
    },
    accessories: values.accessories.map((a) => ({ name: a.name.trim(), quantity: a.quantity, notes: blank(a.notes) })),
    assignedTechnicianId: blank(values.assignedTechnicianId),
    estimatedDeliveryDate: blank(values.estimatedDeliveryDate),
    receivedAt: receivedAt.toISOString(),
  };
};

export const toUpdateIntakeRequest = (values: UpdateIntakeFormValues): UpdateWorkOrderIntakeRequest => ({
  client: {
    fullName: values.client.fullName.trim(),
    documentId: values.client.documentId.trim(),
    email: values.client.email.trim(),
    phone: blank(values.client.phone) ?? null,
    address: blank(values.client.address) ?? null,
  },
  equipment: {
    equipmentTypeId: values.equipment.equipmentTypeId,
    brand: values.equipment.brand.trim(),
    model: values.equipment.model.trim(),
    serialNumber: values.equipment.serialNumber.trim(),
    technicalSpecs: buildSpecsRecord(values.equipment.technicalSpecs, values.extraSpecs),
  },
  reportedIssue: values.reportedIssue.trim(),
  reception: {
    powerStatus: values.reception.powerStatus,
    physicalCondition: values.reception.physicalCondition,
    visibleDamage: blank(values.reception.visibleDamage),
    functionalNotes: blank(values.reception.functionalNotes),
  },
  estimatedDeliveryDate: blank(values.estimatedDeliveryDate) ?? null,
});

export const parseAmountInput = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw || !/^-?\d+(?:\.\d{1,2})?$/.test(raw)) return Number.NaN;
  return Number(raw);
};

const amountFieldSchema = z
  .number({ invalid_type_error: 'Ingrese un valor válido (solo números, ej.: 45.50)' })
  .finite('Ingrese un valor válido (solo números, ej.: 45.50)')
  .min(0, 'El valor no puede ser negativo. Ingrese un valor válido')
  .max(99_999_999.99, 'El valor supera el límite permitido');

export const quotationSchema = z.object({
  amount: amountFieldSchema,
  description: z.string().trim().min(3, 'Detalle la cotización').max(4000),
  estimatedDays: z.number().int('Días enteros').min(1).max(365).optional(),
});
export type QuotationFormValues = z.infer<typeof quotationSchema>;

export const technicalLogSchema = z
  .object({
    diagnosis: optionalText(10000),
    procedures: optionalText(10000),
    configurations: optionalText(10000),
    spareParts: optionalText(10000),
    observations: optionalText(10000),
  })
  .refine((v) => Object.values(v).some((x) => x && x.trim() !== ''), {
    message: 'Complete al menos un campo',
    path: ['observations'],
  });
export type TechnicalLogFormValues = z.infer<typeof technicalLogSchema>;

export const deliverySchema = z.object({
  workSummary: z.string().trim().min(3, 'Describa el trabajo realizado').max(4000),
  amountCharged: amountFieldSchema,
  returnCondition: z.string().trim().min(3, 'Describa las condiciones de entrega').max(4000),
  accessoriesNotes: optionalText(500),
  receivedByName: personNameField(3, 150, 'Nombre de quien retira'),
  receivedByDocument: optionalDocumentIdField,
  returnedAccessoryIds: z.array(z.string()),
});
export type DeliveryFormValues = z.infer<typeof deliverySchema>;
