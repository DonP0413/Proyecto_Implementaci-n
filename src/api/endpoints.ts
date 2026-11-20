/**
 * Objetivo: funciones de acceso a la API agrupadas por recurso. Los
 * componentes NUNCA llaman a axios directamente: usan estos endpoints a
 * través de los hooks de React Query.
 */
import { http, toMultipart } from './http';
import type {
  Attachment,
  Client,
  ClientInput,
  CreateWorkOrderRequest,
  EquipmentMatch,
  EquipmentType,
  LoginResponse,
  Paginated,
  TechnicalLog,
  UpdateWorkOrderIntakeRequest,
  User,
  UserRole,
  WorkOrderCreated,
  WorkOrderDetail,
  WorkOrderFilters,
  WorkOrderStats,
  WorkOrderStatus,
  WorkOrderSummary,
} from './types';

const clean = <T extends object>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)),
  );

export const authApi = {
  login: (username: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
};

export const workOrdersApi = {
  search: (filters: WorkOrderFilters) =>
    http
      .get<Paginated<WorkOrderSummary>>('/work-orders', {
        params: clean({ ...filters, status: filters.status?.join(',') }),
      })
      .then((r) => r.data),
  stats: () => http.get<WorkOrderStats>('/work-orders/stats').then((r) => r.data),
  byCode: (code: string) => http.get<{ id: string; code: string }>(`/work-orders/by-code/${encodeURIComponent(code)}`).then((r) => r.data),
  detail: (id: string) => http.get<WorkOrderDetail>(`/work-orders/${id}`).then((r) => r.data),
  create: (data: CreateWorkOrderRequest, photos: File[]) =>
    http.post<WorkOrderCreated>('/work-orders', toMultipart(data, { photos })).then((r) => r.data),
  updateIntake: (id: string, data: UpdateWorkOrderIntakeRequest) =>
    http.patch<WorkOrderDetail>(`/work-orders/${id}/intake`, data).then((r) => r.data),
  changeStatus: (id: string, status: WorkOrderStatus, note?: string) =>
    http.patch<WorkOrderDetail>(`/work-orders/${id}/status`, { status, note }).then((r) => r.data),
  assignTechnician: (id: string, technicianId: string | null) =>
    http.patch<WorkOrderDetail>(`/work-orders/${id}/technician`, { technicianId }).then((r) => r.data),
  createQuotation: (id: string, data: { amount: number; description: string; estimatedDays?: number }) =>
    http.post<WorkOrderDetail>(`/work-orders/${id}/quotations`, data).then((r) => r.data),
  registerDelivery: (
    id: string,
    data: {
      workSummary: string;
      amountCharged: number;
      returnCondition: string;
      accessoriesNotes?: string;
      receivedByName: string;
      receivedByDocument?: string;
      returnedAccessoryIds: string[];
    },
    photo?: File,
  ) => http.post<WorkOrderDetail>(`/work-orders/${id}/delivery`, toMultipart(data, { photo })).then((r) => r.data),
  addTechnicalLog: (
    id: string,
    data: Partial<Record<'diagnosis' | 'procedures' | 'configurations' | 'spareParts' | 'observations', string>>,
    documents: File[],
  ) => http.post<TechnicalLog>(`/work-orders/${id}/technical-logs`, toMultipart(data, { documents })).then((r) => r.data),
  uploadAttachment: (id: string, category: 'RECEPTION_PHOTO' | 'DELIVERY_PHOTO' | 'TECHNICAL_DOCUMENT', file: File) => {
    const form = new FormData();
    form.append('category', category);
    form.append('file', file);
    return http.post<Attachment>(`/work-orders/${id}/attachments`, form).then((r) => r.data);
  },
};

/** Documentos PDF para el cliente (incluyen las políticas de garantía). */
export const workOrderPdfPaths = {
  reception: (id: string) => `/work-orders/${id}/receipt`,
  quotation: (id: string) => `/work-orders/${id}/quotation-pdf`,
  ready: (id: string) => `/work-orders/${id}/ready-pdf`,
};

export const clientsApi = {
  search: (q: string, page = 1, limit = 20) =>
    http.get<Paginated<Client>>('/clients', { params: clean({ q, page, limit }) }).then((r) => r.data),
  get: (id: string) => http.get<Client>(`/clients/${id}`).then((r) => r.data),
  create: (data: ClientInput) => http.post<Client>('/clients', data).then((r) => r.data),
  update: (id: string, data: Partial<ClientInput>) => http.patch<Client>(`/clients/${id}`, data).then((r) => r.data),
};

export const catalogApi = {
  equipmentTypes: () => http.get<EquipmentType[]>('/equipment-types').then((r) => r.data),
  findBySerial: (serial: string) => http.get<EquipmentMatch[]>('/equipments', { params: { serial } }).then((r) => r.data),
  technicians: () => http.get<User[]>('/users/technicians').then((r) => r.data),
};

export const usersApi = {
  list: () => http.get<User[]>('/users').then((r) => r.data),
  create: (data: { fullName: string; username: string; password: string; role: UserRole }) =>
    http.post<User>('/users', data).then((r) => r.data),
  update: (id: string, data: Partial<{ fullName: string; role: UserRole; isActive: boolean }>) =>
    http.patch<User>(`/users/${id}`, data).then((r) => r.data),
  resetPassword: (id: string, password: string) => http.put(`/users/${id}/password`, { password }),
};

/** Descarga un recurso protegido (requiere token) como blob: URL local + nombre de archivo sugerido. */
export const fetchProtectedFile = async (path: string): Promise<{ url: string; filename: string }> => {
  const response = await http.get<Blob>(path, { responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const filename = encoded ? decodeURIComponent(encoded) : (plain ?? 'documento.pdf');
  return { url: URL.createObjectURL(response.data), filename };
};

/** Descarga un recurso protegido (requiere token) y lo abre en una pestaña nueva. */
export const openProtectedFile = async (path: string): Promise<void> => {
  const response = await http.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
