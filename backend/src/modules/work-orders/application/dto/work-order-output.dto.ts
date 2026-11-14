/**
 * Objetivo: DTOs de SALIDA. El detalle separa explícitamente:
 *   - clientVisible: lo que puede verse/enviarse al cliente.
 *   - internal: registro técnico y documentos internos (requerimiento 7).
 */
import { WorkOrderStatus } from '../../domain/work-order-status';
import {
  AttachmentCategory,
  AttachmentVisibility,
  PhysicalCondition,
  PowerStatus,
} from '../../domain/work-order.enums';

export interface PersonRef {
  id: string;
  fullName: string;
}

export interface AttachmentDto {
  id: string;
  category: AttachmentCategory;
  visibility: AttachmentVisibility;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  technicalLogId: string | null;
  createdAt: string;
  downloadPath: string;
}

export interface WorkOrderSummaryDto {
  id: string;
  code: string;
  status: WorkOrderStatus;
  statusLabel: string;
  receivedAt: string;
  estimatedDeliveryDate: string | null;
  deliveredAt: string | null;
  client: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    documentId: string | null;
    address: string | null;
  };
  equipment: {
    id: string;
    equipmentTypeId: number;
    typeName: string;
    brand: string;
    model: string;
    serialNumber: string | null;
  };
  assignedTechnician: PersonRef | null;
}

export interface QuotationDto {
  id: string;
  amount: number;
  description: string;
  estimatedDays: number | null;
  createdBy: PersonRef | null;
  createdAt: string;
  notifiedAt: string | null;
}

export interface TechnicalLogDto {
  id: string;
  author: PersonRef | null;
  diagnosis: string | null;
  procedures: string | null;
  configurations: string | null;
  spareParts: string | null;
  observations: string | null;
  createdAt: string;
  attachments: AttachmentDto[];
}

export interface StatusHistoryDto {
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  toStatusLabel: string;
  note: string | null;
  changedBy: PersonRef | null;
  changedAt: string;
}

export interface WorkOrderDetailDto extends WorkOrderSummaryDto {
  receivedBy: PersonRef | null;
  allowedTransitions: Array<{ status: WorkOrderStatus; label: string }>;
  actions: {
    canEditIntake: boolean;
    canCreateQuotation: boolean;
    canSendQuotation: boolean;
    canNotifyReadyForPickup: boolean;
    canRegisterDelivery: boolean;
  };
  clientVisible: {
    reportedIssue: string;
    specs: Array<{ key: string; label: string; value: string }>;
    rawSpecs: Record<string, string>;
    reception: {
      powerStatus: PowerStatus;
      powerStatusLabel: string;
      physicalCondition: PhysicalCondition;
      physicalConditionLabel: string;
      visibleDamage: string | null;
      functionalNotes: string | null;
    } | null;
    accessories: Array<{
      id: string;
      name: string;
      quantity: number;
      notes: string | null;
      returned: boolean;
    }>;
    quotations: QuotationDto[];
    delivery: {
      workSummary: string;
      amountCharged: number;
      returnCondition: string;
      accessoriesNotes: string | null;
      receivedByName: string;
      receivedByDocument: string | null;
      deliveredBy: PersonRef | null;
      deliveredAt: string;
    } | null;
    attachments: AttachmentDto[];
  };
  internal: {
    technicalLogs: TechnicalLogDto[];
    attachments: AttachmentDto[];
  };
  statusHistory: StatusHistoryDto[];
}

export interface WorkOrderCreatedDto {
  id: string;
  code: string;
  status: WorkOrderStatus;
  receiptPath: string;
}
