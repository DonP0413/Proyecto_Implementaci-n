/**
 * Objetivo: funciones de acceso a la API agrupadas por recurso. Los
 * componentes NUNCA llaman a axios directamente: usan estos endpoints a
 * través de los hooks de React Query.
 */
import { env } from '../config/env';
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

/**
 * Abre un archivo protegido (PDF de la orden o adjunto) en una pestaña/ventana nueva
 * con su URL REAL: el servidor envía Content-Type y Content-Disposition, así que al
 * guardarlo se propone un nombre claro con extensión (p. ej. Comprobante_Ingreso_PT-2026-000001.pdf).
 * Antes se abría como blob:, que perdía nombre y extensión.
 * Una pestaña no puede enviar el header Authorization: se pide un enlace temporal
 * (2 min, sólo para esta ruta) y se pasa como ?dl=<token>.
 * Debe llamarse dentro del clic: la pestaña se abre antes de esperar a la API para
 * que el bloqueador de ventanas emergentes no la impida.
 */
export const openProtectedFile = async (path: string): Promise<void> => {
  const tab = window.open('', '_blank');
  try {
    const { data } = await http.post<{ token: string }>('/auth/download-token', { path });
    const url = new URL(`${env.apiUrl}${path}`, window.location.href);
    url.searchParams.set('dl', data.token);
    if (tab) {
      tab.opener = null;
      tab.location.href = url.toString();
      return;
    }
    // Ventanas emergentes bloqueadas: se descarga con el nombre que envía el servidor.
    const link = document.createElement('a');
    link.href = url.toString();
    link.download = '';
    link.click();
  } catch (error) {
    tab?.close();
    throw error;
  }
};
