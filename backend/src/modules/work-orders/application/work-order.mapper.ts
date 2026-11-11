/**
 * Objetivo: traducir entidades ORM a DTOs de salida (anti-corruption layer).
 * Ninguna entidad TypeORM sale por la API: así un cambio de esquema no
 * rompe el contrato con el frontend y nunca se filtran campos sensibles.
 */
import { EXTRA_SPEC_PREFIX, type SpecField } from '../../equipment/equipment-type.entity';
import type { UserEntity } from '../../users/user.entity';
import {
  WORK_ORDER_STATUS_LABELS,
  WorkOrderStateMachine,
  WorkOrderStatus,
} from '../domain/work-order-status';
import {
  AttachmentVisibility,
  PHYSICAL_CONDITION_LABELS,
  POWER_STATUS_LABELS,
} from '../domain/work-order.enums';
import type { AttachmentEntity, WorkOrderEntity } from '../infrastructure/entities';
import type {
  AttachmentDto,
  PersonRef,
  WorkOrderDetailDto,
  WorkOrderSummaryDto,
} from './dto/work-order-output.dto';

const person = (user?: UserEntity | null): PersonRef | null =>
  user ? { id: user.id, fullName: user.fullName } : null;

/**
 * Características con etiqueta legible, en el orden del catálogo:
 *   "Memoria RAM · Capacidad" -> "16 GB". Luego campos antiguos y, al final,
 *   las especificaciones adicionales libres ("+Lector de huella").
 */
export const specsWithLabels = (
  schema: SpecField[] = [],
  specs: Record<string, string> = {},
): Array<{ key: string; label: string; value: string }> => {
  const order = new Map(schema.map((field, index) => [field.key, index]));
  const fields = new Map(schema.map((field) => [field.key, field]));
  const rank = (key: string) =>
    key.startsWith(EXTRA_SPEC_PREFIX)
      ? Number.MAX_SAFE_INTEGER
      : (order.get(key) ?? Number.MAX_SAFE_INTEGER - 1);
  return Object.entries(specs)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, value]) => {
      if (key.startsWith(EXTRA_SPEC_PREFIX)) {
        return { key, label: key.slice(EXTRA_SPEC_PREFIX.length), value };
      }
      const field = fields.get(key);
      if (!field) return { key, label: key, value };
      const label = field.group ? `${field.group} · ${field.label}` : field.label;
      const withUnit = field.unit && /^-?\d+(\.\d+)?$/.test(value) ? `${value} ${field.unit}` : value;
      return { key, label, value: withUnit };
    });
};

export class WorkOrderMapper {
  static attachment(entity: AttachmentEntity): AttachmentDto {
    return {
      id: entity.id,
      category: entity.category,
      visibility: entity.visibility,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      technicalLogId: entity.technicalLogId,
      createdAt: entity.createdAt.toISOString(),
      downloadPath: `/work-orders/${entity.workOrderId}/attachments/${entity.id}/download`,
    };
  }

  static summary(entity: WorkOrderEntity): WorkOrderSummaryDto {
    return {
      id: entity.id,
      code: entity.code,
      status: entity.status,
      statusLabel: WORK_ORDER_STATUS_LABELS[entity.status],
      receivedAt: entity.receivedAt.toISOString(),
      estimatedDeliveryDate: entity.estimatedDeliveryDate,
      deliveredAt: entity.deliveredAt ? entity.deliveredAt.toISOString() : null,
      client: {
        id: entity.client.id,
        fullName: entity.client.fullName,
        email: entity.client.email,
        phone: entity.client.phone,
        documentId: entity.client.documentId,
      },
      equipment: {
        id: entity.equipment.id,
        typeName: entity.equipment.equipmentType?.name ?? '',
        brand: entity.equipment.brand,
        model: entity.equipment.model,
        serialNumber: entity.equipment.serialNumber,
      },
      assignedTechnician: person(entity.assignedTechnician),
    };
  }

  static detail(entity: WorkOrderEntity): WorkOrderDetailDto {
    const attachments = entity.attachments ?? [];
    const clientAttachments = attachments.filter((a) => a.visibility === AttachmentVisibility.CLIENT);
    const internalAttachments = attachments.filter((a) => a.visibility === AttachmentVisibility.INTERNAL);
    const quotations = entity.quotations ?? [];
    const rc = entity.receptionCondition;
    const dr = entity.deliveryRecord;

    return {
      ...WorkOrderMapper.summary(entity),
      receivedBy: person(entity.receivedBy),
      allowedTransitions: WorkOrderStateMachine.manualTransitions(entity.status).map((status) => ({
        status,
        label: WORK_ORDER_STATUS_LABELS[status],
      })),
      actions: {
        canCreateQuotation: [WorkOrderStatus.EN_REVISION, WorkOrderStatus.COTIZACION_GENERADA].includes(
          entity.status,
        ),
        canSendQuotation: entity.status === WorkOrderStatus.COTIZACION_GENERADA && quotations.length > 0,
        canNotifyReadyForPickup: entity.status === WorkOrderStatus.LISTO_PARA_RETIRAR,
        canRegisterDelivery: entity.status === WorkOrderStatus.LISTO_PARA_RETIRAR,
      },
      clientVisible: {
        reportedIssue: entity.reportedIssue,
        specs: specsWithLabels(entity.equipment.equipmentType?.specSchema, entity.specsSnapshot),
        reception: rc
          ? {
              powerStatus: rc.powerStatus,
              powerStatusLabel: POWER_STATUS_LABELS[rc.powerStatus],
              physicalCondition: rc.physicalCondition,
              physicalConditionLabel: PHYSICAL_CONDITION_LABELS[rc.physicalCondition],
              visibleDamage: rc.visibleDamage,
              functionalNotes: rc.functionalNotes,
            }
          : null,
        accessories: (entity.accessories ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          quantity: a.quantity,
          notes: a.notes,
          returned: a.returned,
        })),
        quotations: quotations.map((q) => ({
          id: q.id,
          amount: q.amount,
          description: q.description,
          estimatedDays: q.estimatedDays,
          createdBy: person(q.createdBy),
          createdAt: q.createdAt.toISOString(),
          notifiedAt: q.notifiedAt ? q.notifiedAt.toISOString() : null,
        })),
        delivery: dr
          ? {
              workSummary: dr.workSummary,
              amountCharged: dr.amountCharged,
              returnCondition: dr.returnCondition,
              accessoriesNotes: dr.accessoriesNotes,
              receivedByName: dr.receivedByName,
              receivedByDocument: dr.receivedByDocument,
              deliveredBy: person(dr.deliveredBy),
              deliveredAt: dr.deliveredAt.toISOString(),
            }
          : null,
        attachments: clientAttachments.map(WorkOrderMapper.attachment),
      },
      internal: {
        technicalLogs: (entity.technicalLogs ?? []).map((log) => ({
          id: log.id,
          author: person(log.author),
          diagnosis: log.diagnosis,
          procedures: log.procedures,
          configurations: log.configurations,
          spareParts: log.spareParts,
          observations: log.observations,
          createdAt: log.createdAt.toISOString(),
          attachments: internalAttachments
            .filter((a) => a.technicalLogId === log.id)
            .map(WorkOrderMapper.attachment),
        })),
        attachments: internalAttachments.map(WorkOrderMapper.attachment),
      },
      statusHistory: (entity.statusHistory ?? []).map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        toStatusLabel: WORK_ORDER_STATUS_LABELS[h.toStatus],
        note: h.note,
        changedBy: person(h.changedBy),
        changedAt: h.changedAt.toISOString(),
      })),
    };
  }
}
