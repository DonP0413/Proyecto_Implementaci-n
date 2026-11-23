/**
 * Objetivo: enlaces temporales de descarga para abrir PDF y adjuntos en una
 * pestaña/ventana nueva. Una pestaña no puede enviar el header Authorization,
 * así que el frontend pide un token de corta duración, ligado a UNA ruta, y lo
 * pasa como ?dl=<token>. Así el archivo llega con su URL real, Content-Type y
 * Content-Disposition (nombre y extensión .pdf), en lugar de un blob: sin nombre.
 */
import type { UserRole } from '../../modules/users/domain/user-role.enum';

/** Audiencia propia: un token de descarga NO sirve como token de sesión (y viceversa). */
export const DOWNLOAD_AUDIENCE = 'pintotech-download';
export const DOWNLOAD_TOKEN_TTL_SECONDS = 120;

/** Rutas (relativas al prefijo de la API) que se pueden abrir con un enlace temporal. */
export const DOWNLOADABLE_PATH =
  /^\/work-orders\/[0-9a-f-]{36}\/(receipt|quotation-pdf|ready-pdf|attachments\/[0-9a-f-]{36}\/download)$/i;

export interface DownloadTokenPayload {
  sub: string;
  username: string;
  name: string;
  role: UserRole;
  /** Ruta exacta para la que se emitió el token. */
  path: string;
}

/** Oculta el token en los registros (el enlace es válido 2 minutos, pero no debe quedar escrito). */
export const redactDownloadToken = (url: string): string => url.replace(/([?&]dl=)[^&]*/, '$1[REDACTED]');
