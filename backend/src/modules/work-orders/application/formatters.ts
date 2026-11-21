/**
 * Objetivo: formateo localizado (es-EC) de fechas y montos para comprobantes
 * PDF. Ecuador usa USD; la zona horaria es configurable.
 */
export const formatMoney = (amount: number): string =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(
    amount,
  );

export const formatDateTime = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(date);

export const formatDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
};
