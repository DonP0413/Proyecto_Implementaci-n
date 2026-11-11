/**
 * Objetivo: esquemas Zod de los formularios (validación en el cliente con
 * las mismas reglas que el backend, para dar feedback inmediato) y
 * funciones que transforman el formulario al contrato de la API.
 */
import { z } from 'zod';
import { EXTRA_SPEC_PREFIX, MAX_EXTRA_SPECS, type CreateWorkOrderRequest } from '../../api/types';
import { toDateInput } from '../../lib/format';

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
  fullName: z.string().trim().min(3, 'Ingrese el nombre completo').max(150),
  documentId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{5,20}$/, 'Documento inválido (5-20 caracteres)')
    .or(z.literal(''))
    .optional(),
  email: z.string().trim().email('Correo inválido: es necesario para las notificaciones'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\s()-]{7,20}$/, 'Teléfono inválido')
    .or(z.literal(''))
    .optional(),
  address: optionalText(250),
  registeredAt: registeredAtSchema.optional(),
});
export type ClientFormValues = z.infer<typeof clientSchema>;

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
    equipment: z.object({
      equipmentTypeId: z.number({ invalid_type_error: 'Seleccione el tipo de equipo' }).int().positive('Seleccione el tipo de equipo'),
      brand: z.string().trim().min(1, 'Ingrese la marca').max(60),
      model: z.string().trim().min(1, 'Ingrese el modelo').max(80),
      serialNumber: optionalText(80),
      technicalSpecs: z.record(z.string()),
    }),
    extraSpecs: z
      .array(
        z.object({
          name: z.string().trim().max(40, 'Máximo 40 caracteres'),
          value: z.string().trim().max(500, 'Máximo 500 caracteres'),
        }),
      )
      .max(MAX_EXTRA_SPECS, `Máximo ${MAX_EXTRA_SPECS} especificaciones adicionales`),
    reportedIssue: z.string().trim().min(3, 'Describa la falla reportada').max(2000),
    reception: z.object({
      powerStatus: z.enum(['SI', 'NO', 'NO_PROBADO'], { errorMap: () => ({ message: 'Indique si enciende' }) }),
      physicalCondition: z.enum(['BUENO', 'REGULAR', 'MALO'], { errorMap: () => ({ message: 'Indique el estado físico' }) }),
      visibleDamage: optionalText(2000),
      functionalNotes: optionalText(2000),
    }),
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
    values.extraSpecs.forEach((extra, index) => {
      if (extra.name && !extra.value) ctx.addIssue({ code: 'custom', path: ['extraSpecs', index, 'value'], message: 'Indique el valor' });
      if (extra.value && !extra.name) ctx.addIssue({ code: 'custom', path: ['extraSpecs', index, 'name'], message: 'Indique qué especificación es' });
    });
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

const blank = (value?: string) => (value && value.trim() !== '' ? value.trim() : undefined);

export const toCreateWorkOrderRequest = (values: NewWorkOrderFormValues): CreateWorkOrderRequest => {
  const receivedAt = new Date(values.receivedAt);
  const specs: Record<string, string> = Object.fromEntries(
    Object.entries(values.equipment.technicalSpecs ?? {})
      .filter(([, v]) => v && String(v).trim() !== '')
      .map(([k, v]) => [k, String(v).trim()]),
  );
  // Especificaciones adicionales libres: viajan en el mismo objeto con prefijo.
  values.extraSpecs.forEach(({ name, value }) => {
    if (name.trim() && value.trim()) specs[`${EXTRA_SPEC_PREFIX}${name.trim()}`] = value.trim();
  });
  return {
    ...(values.clientMode === 'existing'
      ? { clientId: values.clientId }
      : {
          client: {
            fullName: values.client!.fullName!.trim(),
            email: values.client!.email!.trim(),
            documentId: blank(values.client?.documentId),
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
      serialNumber: blank(values.equipment.serialNumber),
      technicalSpecs: specs,
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

export const quotationSchema = z.object({
  amount: z.number({ invalid_type_error: 'Ingrese el valor' }).min(0, 'No puede ser negativo').max(99_999_999.99),
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
    path: ['diagnosis'],
  });
export type TechnicalLogFormValues = z.infer<typeof technicalLogSchema>;

export const deliverySchema = z.object({
  workSummary: z.string().trim().min(3, 'Describa el trabajo realizado').max(4000),
  amountCharged: z.number({ invalid_type_error: 'Ingrese el valor cobrado' }).min(0).max(99_999_999.99),
  returnCondition: z.string().trim().min(3, 'Describa las condiciones de entrega').max(4000),
  accessoriesNotes: optionalText(500),
  receivedByName: z.string().trim().min(3, 'Nombre de quien retira').max(150),
  receivedByDocument: optionalText(20),
  returnedAccessoryIds: z.array(z.string()),
});
export type DeliveryFormValues = z.infer<typeof deliverySchema>;
