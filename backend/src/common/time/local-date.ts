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

/** Suma días a una fecha YYYY-MM-DD. */
export const addDays = (isoDate: string, days: number): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

/** Instante (UTC) en que empieza el día YYYY-MM-DD en la zona horaria indicada. */
export const startOfLocalDay = (isoDate: string, timeZone = 'America/Guayaquil'): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  // Desfase de la zona horaria en ese momento (p. ej. Ecuador = -5 h).
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMidnight));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asLocal = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return new Date(utcMidnight - (asLocal - utcMidnight));
};

/** Formato en que TypeORM guarda las fechas-hora en SQLite (UTC): 'YYYY-MM-DD HH:MM:SS.SSS'. */
export const toDbDatetime = (date: Date): string => date.toISOString().replace('T', ' ').replace('Z', '');

/** Margen para relojes de PC desincronizados al validar fechas "no futuras". */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
