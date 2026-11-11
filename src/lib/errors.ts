/** Objetivo: extraer un mensaje legible para el usuario desde cualquier error de la API. */
import { isAxiosError } from 'axios';
import type { ApiErrorBody } from '../api/types';

export const getErrorMessage = (error: unknown): string => {
  if (isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Verifique su conexión.';
    const message = error.response.data?.message;
    if (Array.isArray(message)) return message.join(' · ');
    if (typeof message === 'string' && message) return message;
    if (error.response.status === 413) return 'El archivo supera el tamaño máximo permitido.';
    return `Error ${error.response.status}`;
  }
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado';
};
