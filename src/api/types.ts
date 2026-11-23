/**
 * Objetivo: contratos TypeScript de la API (espejo de los DTOs del backend).
 * Cualquier cambio en el backend debe reflejarse aquí en el mismo PR.
 */
export type UserRole = 'ADMIN' | 'RECEPCIONISTA' | 'TECNICO';

export type WorkOrderStatus =
  | 'INGRESADO'
  | 'EN_REVISION'
  | 'COTIZACION_GENERADA'
  | 'EN_REPARACION'
  | 'LISTO_PARA_RETIRAR'
  | 'ENTREGADO';

export type PowerStatus = 'SI' | 'NO' | 'NO_PROBADO';
export type PhysicalCondition = 'BUENO' | 'REGULAR' | 'MALO';
export type AttachmentCategory = 'RECEPTION_PHOTO' | 'DELIVERY_PHOTO' | 'TECHNICAL_DOCUMENT' | 'RECEIPT_PDF';

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: unknown;
  requestId?: string;
}

export interface User {
  id: string;
  fullName: string;
  /** Nombre de usuario para iniciar sesión. */
  username: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: string;
  user: User;
}

export interface Client {
  id: string;
  fullName: string;
  documentId: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  /** Fecha de ingreso del cliente (YYYY-MM-DD). */
  registeredAt: string;
  createdAt: string;
}

export interface ClientInput {
  fullName: string;
  documentId: string;
  email: string;
  phone?: string;
  address?: string;
  /** YYYY-MM-DD; si se omite, el backend usa la fecha de hoy. */
  registeredAt?: string;
}

export interface SpecField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select';
  /** Agrupa campos en el formulario ("Memoria RAM"). */
  group?: string;
  placeholder?: string;
  hint?: string;
  /** Unidad del valor numérico ("GB", "%"). */
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  /** Campo de una versión anterior: no se muestra en el formulario. */
  legacy?: boolean;
}

/** Prefijo de las especificaciones adicionales libres dentro de technicalSpecs. */
export const EXTRA_SPEC_PREFIX = '+';
export const MAX_EXTRA_SPECS = 10;

export interface EquipmentType {
  id: number;
  code: string;
  name: string;
  specSchema: SpecField[];
}

export interface EquipmentMatch {
  id: string;
  clientId: string;
  client?: { id: string; fullName: string; documentId: string | null };
  equipmentType: { id: number; code: string; name: string };
  brand: string;
  model: string;
  serialNumber: string | null;
  technicalSpecs: Record<string, string>;
}

export interface PersonRef {
  id: string;
  fullName: string;
}

export interface Attachment {
  id: string;
  category: AttachmentCategory;
  visibility: 'CLIENT' | 'INTERNAL';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  technicalLogId: string | null;
  createdAt: string;
  downloadPath: string;
}

export interface WorkOrderSummary {
  id: string;
  code: string;
  status: WorkOrderStatus;
  statusLabel: string;
  receivedAt: string;
  estimatedDeliveryDate: string | null;
  deliveredAt: string | null;
  client: { id: string; fullName: string; email: string; phone: string | null; documentId: string | null; address?: string | null };
  equipment: { id: string; equipmentTypeId?: number; typeName: string; brand: string; model: string; serialNumber: string | null };
  assignedTechnician: PersonRef | null;
}

export interface Quotation {
  id: string;
  amount: number;
  description: string;
  estimatedDays: number | null;
  createdBy: PersonRef | null;
  createdAt: string;
  notifiedAt: string | null;
}

export interface TechnicalLog {
  id: string;
  author: PersonRef | null;
  diagnosis: string | null;
  procedures: string | null;
  configurations: string | null;
  spareParts: string | null;
  observations: string | null;
  createdAt: string;
  attachments: Attachment[];
}

export interface Accessory {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  returned: boolean;
}

export interface WorkOrderDetail extends WorkOrderSummary {
  receivedBy: PersonRef | null;
  /** notePrompt: si no es null, la transición exige una nota con ese motivo. */
  allowedTransitions: Array<{ status: WorkOrderStatus; label: string; notePrompt: string | null }>;
  actions: {
    canEditIntake?: boolean;
    canCreateQuotation: boolean;
    canDownloadQuotationPdf: boolean;
    canDownloadReadyPdf: boolean;
    canRegisterDelivery: boolean;
  };
  clientVisible: {
    reportedIssue: string;
    specs: Array<{ key: string; label: string; value: string }>;
    rawSpecs?: Record<string, string>;
    reception: {
      powerStatus: PowerStatus;
      powerStatusLabel: string;
      physicalCondition: PhysicalCondition;
      physicalConditionLabel: string;
      visibleDamage: string | null;
      functionalNotes: string | null;
    } | null;
    accessories: Accessory[];
    quotations: Quotation[];
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
    attachments: Attachment[];
  };
  internal: { technicalLogs: TechnicalLog[]; attachments: Attachment[] };
  statusHistory: Array<{
    fromStatus: WorkOrderStatus | null;
    toStatus: WorkOrderStatus;
    toStatusLabel: string;
    note: string | null;
    changedBy: PersonRef | null;
    changedAt: string;
  }>;
}

export interface WorkOrderCreated {
  id: string;
  code: string;
  status: WorkOrderStatus;
  receiptPath: string;
}

export interface CreateWorkOrderRequest {
  clientId?: string;
  client?: ClientInput;
  equipment: {
    equipmentTypeId: number;
    brand: string;
    model: string;
    serialNumber: string;
    technicalSpecs?: Record<string, string>;
    forceNewEquipment?: boolean;
  };
  reportedIssue: string;
  reception: {
    powerStatus: PowerStatus;
    physicalCondition: PhysicalCondition;
    visibleDamage?: string;
    functionalNotes?: string;
  };
  accessories: Array<{ name: string; quantity: number; notes?: string }>;
  assignedTechnicianId?: string;
  estimatedDeliveryDate?: string;
  /** Fecha y hora de ingreso del equipo (ISO 8601). Si se omite, es el momento del registro. */
  receivedAt?: string;
}

export interface UpdateWorkOrderIntakeRequest {
  client: {
    fullName: string;
    documentId: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
  equipment: {
    equipmentTypeId: number;
    brand: string;
    model: string;
    serialNumber: string;
    technicalSpecs?: Record<string, string>;
  };
  reportedIssue: string;
  reception: {
    powerStatus: PowerStatus;
    physicalCondition: PhysicalCondition;
    visibleDamage?: string;
    functionalNotes?: string;
  };
  estimatedDeliveryDate?: string | null;
}

export interface WorkOrderFilters {
  q?: string;
  code?: string;
  client?: string;
  clientId?: string;
  equipmentId?: string;
  serial?: string;
  status?: WorkOrderStatus[];
  dateFrom?: string;
  dateTo?: string;
  technicianId?: string;
  page?: number;
  limit?: number;
}

export interface WorkOrderStats {
  total: number;
  byStatus: Array<{ status: WorkOrderStatus; label: string; count: number }>;
}
