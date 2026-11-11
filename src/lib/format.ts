/** Objetivo: formateo consistente (es-EC, USD, America/Guayaquil) en toda la UI. */
const TZ = 'America/Guayaquil';

export const formatMoney = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);

export const formatDateTime = (iso: string | null | undefined): string =>
  iso ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(iso)) : '—';

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: TZ }).format(date);
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local del navegador como YYYY-MM-DD (valor de <input type="date">). */
export const toDateInput = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Fecha y hora local como YYYY-MM-DDTHH:mm (valor de <input type="datetime-local">). */
export const toDateTimeInput = (date: Date = new Date()): string =>
  `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Convierte cadenas vacías en undefined (el backend rechaza "" en campos opcionales con formato). */
export const emptyToUndefined = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? undefined : v]),
  ) as T;
