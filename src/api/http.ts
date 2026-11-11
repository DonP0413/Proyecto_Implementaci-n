/**
 * Objetivo: cliente HTTP único (Axios). Adjunta el JWT, propaga un
 * x-request-id para correlacionar logs front/back, y cierra la sesión
 * automáticamente si el token expira (401).
 */
import axios from 'axios';
import { env } from '../config/env';
import { useAuthStore } from '../stores/authStore';

export const http = axios.create({ baseURL: env.apiUrl, timeout: 60_000 });

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // randomUUID sólo existe en contextos seguros (HTTPS/localhost); fallback para LAN por HTTP.
  config.headers['x-request-id'] =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    if (status === 401 && !url.includes('/auth/login')) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

/** Construye multipart/form-data con un campo `data` JSON + archivos. */
export const toMultipart = (data: unknown, files: Record<string, File[] | File | undefined>): FormData => {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  for (const [field, value] of Object.entries(files)) {
    if (!value) continue;
    (Array.isArray(value) ? value : [value]).forEach((file) => form.append(field, file));
  }
  return form;
};
