/**
 * Objetivo: utilidades de fecha "de calendario" en la zona horaria del
 * negocio (America/Guayaquil por defecto). Evitan el error clásico de usar
 * la fecha UTC del servidor, que después de las 19:00 en Ecuador ya es "mañana".
 */

/** Fecha YYYY-MM-DD de un instante, en la zona horaria indicada. */
export const toLocalDate = (instant: Date, timeZone = 'America/Guayaquil'): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    instant,
  );

/** Fecha YYYY-MM-DD de hoy en la zona horaria indicada. */
export const todayLocalDate = (timeZone?: string): string => toLocalDate(new Date(), timeZone);

/** Margen para relojes de PC desincronizados al validar fechas "no futuras". */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
