/**
 * Objetivo: Factory Pattern que construye, para cada tipo de notificación,
 * el asunto y el payload (datos + adjuntos) a partir del agregado.
 * REGLA DE SEGURIDAD: aquí sólo se leen datos visibles para el cliente; el
 * registro técnico interno nunca se incluye (el agregado ni siquiera lo carga).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationAttachmentRef,
  NotificationPayload,
  NotificationType,
} from '../../notifications/domain/notification.enums';
import { WORK_ORDER_STATUS_LABELS } from '../domain/work-order-status';
import {
  AttachmentCategory,
  AttachmentVisibility,
  PHYSICAL_CONDITION_LABELS,
  POWER_STATUS_LABELS,
} from '../domain/work-order.enums';
import type { AttachmentEntity, WorkOrderEntity } from '../infrastructure/entities';
import { formatDateTime, formatMoney } from './formatters';
import { specsWithLabels } from './work-order.mapper';

export interface BuiltNotification {
  subject: string;
  recipientEmail: string;
  payload: NotificationPayload;
}

const SUBJECTS: Record<NotificationType, (code: string) => string> = {
  [NotificationType.RECEPTION]: (code) => `Recibimos su equipo - Orden ${code}`,
  [NotificationType.QUOTATION]: (code) => `Cotización de reparación - Orden ${code}`,
  [NotificationType.READY_FOR_PICKUP]: (code) => `Su equipo está listo para retirar - Orden ${code}`,
  [NotificationType.DELIVERY]: (code) => `Entrega de equipo confirmada - Orden ${code}`,
};

@Injectable()
export class NotificationPayloadFactory {
  constructor(private readonly config: ConfigService) {}

  build(type: NotificationType, wo: WorkOrderEntity, attachments: AttachmentEntity[]): BuiltNotification {
    const timeZone = this.config.get<string>('workOrders.timezone') ?? 'America/Guayaquil';
    const maxPhotos = this.config.get<number>('notifications.maxEmailPhotos') ?? 3;
    const clientSafe = attachments.filter((a) => a.visibility === AttachmentVisibility.CLIENT);
    const latestQuotation = [...(wo.quotations ?? [])].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];

    const photosFor = (category: AttachmentCategory) =>
      clientSafe.filter((a) => a.category === category).slice(0, maxPhotos);

    let files: AttachmentEntity[] = [];
    if (type === NotificationType.RECEPTION) {
      files = [
        ...clientSafe.filter((a) => a.category === AttachmentCategory.RECEIPT_PDF),
        ...photosFor(AttachmentCategory.RECEPTION_PHOTO),
      ];
    } else if (type === NotificationType.DELIVERY) {
      files = photosFor(AttachmentCategory.DELIVERY_PHOTO);
    }
    const photoCount = files.filter((f) => f.category !== AttachmentCategory.RECEIPT_PDF).length;

    const data: Record<string, unknown> = {
      company: this.config.get('company'),
      workOrder: {
        code: wo.code,
        receivedAt: formatDateTime(wo.receivedAt, timeZone),
        statusLabel: WORK_ORDER_STATUS_LABELS[wo.status],
      },
      client: { fullName: wo.client.fullName },
      equipment: {
        typeName: wo.equipment.equipmentType?.name ?? '',
        brand: wo.equipment.brand,
        model: wo.equipment.model,
        serialNumber: wo.equipment.serialNumber,
        specs: specsWithLabels(wo.equipment.equipmentType?.specSchema, wo.specsSnapshot),
      },
      reportedIssue: wo.reportedIssue,
      reception: wo.receptionCondition
        ? {
            powerStatus: POWER_STATUS_LABELS[wo.receptionCondition.powerStatus],
            physicalCondition: PHYSICAL_CONDITION_LABELS[wo.receptionCondition.physicalCondition],
            visibleDamage: wo.receptionCondition.visibleDamage,
            functionalNotes: wo.receptionCondition.functionalNotes,
          }
        : null,
      accessories: (wo.accessories ?? []).map((a) => ({
        name: a.name,
        quantity: a.quantity,
        notes: a.notes,
      })),
      deliveredAccessories: (wo.accessories ?? [])
        .filter((a) => a.returned)
        .map((a) => ({ name: a.name, quantity: a.quantity })),
      quotation: latestQuotation
        ? {
            amount: formatMoney(latestQuotation.amount),
            description: latestQuotation.description,
            estimatedDays: latestQuotation.estimatedDays,
          }
        : null,
      delivery: wo.deliveryRecord
        ? {
            workSummary: wo.deliveryRecord.workSummary,
            amountCharged: formatMoney(wo.deliveryRecord.amountCharged),
            returnCondition: wo.deliveryRecord.returnCondition,
            accessoriesNotes: wo.deliveryRecord.accessoriesNotes,
            receivedByName: wo.deliveryRecord.receivedByName,
            deliveredAt: formatDateTime(wo.deliveryRecord.deliveredAt, timeZone),
          }
        : null,
      hasPhotos: photoCount > 0,
      photoCount,
    };

    const refs: NotificationAttachmentRef[] = files.map((file, index) => ({
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      filename:
        file.category === AttachmentCategory.RECEIPT_PDF
          ? `comprobante-${wo.code}.pdf`
          : `foto-${index}-${wo.code}.${file.storageKey.split('.').pop()}`,
    }));

    return {
      subject: SUBJECTS[type](wo.code),
      recipientEmail: wo.client.email,
      payload: { data, attachments: refs },
    };
  }
}
