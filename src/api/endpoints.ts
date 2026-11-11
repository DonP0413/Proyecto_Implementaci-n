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
  EquipmentType,
  LoginResponse,
  NotificationItem,
  Paginated,
  TechnicalLog,
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
  login: (email: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),
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
  notifications: (id: string) => http.get<NotificationItem[]>(`/work-orders/${id}/notifications`).then((r) => r.data),
  sendQuotation: (id: string) =>
    http.post<NotificationItem>(`/work-orders/${id}/notifications/quotation`).then((r) => r.data),
  sendReadyForPickup: (id: string) =>
    http.post<NotificationItem>(`/work-orders/${id}/notifications/ready-for-pickup`).then((r) => r.data),
};

export const notificationsApi = {
  list: (status: 'FAILED' | 'PENDING' | 'SENT' = 'FAILED') =>
    http.get<NotificationItem[]>('/notifications', { params: { status } }).then((r) => r.data),
  retry: (id: string) => http.post<NotificationItem>(`/notifications/${id}/retry`).then((r) => r.data),
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
  technicians: () => http.get<User[]>('/users/technicians').then((r) => r.data),
};

export const usersApi = {
  list: () => http.get<User[]>('/users').then((r) => r.data),
  create: (data: { fullName: string; email: string; password: string; role: UserRole }) =>
    http.post<User>('/users', data).then((r) => r.data),
  update: (id: string, data: Partial<{ fullName: string; role: UserRole; isActive: boolean }>) =>
    http.patch<User>(`/users/${id}`, data).then((r) => r.data),
  resetPassword: (id: string, password: string) => http.put(`/users/${id}/password`, { password }),
};

/** Descarga un recurso protegido (requiere token) y lo abre en una pestaña nueva. */
export const openProtectedFile = async (path: string): Promise<void> => {
  const response = await http.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
