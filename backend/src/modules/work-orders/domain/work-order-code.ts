/**
 * Objetivo: Factory del "ID único de trabajo" legible para el cliente.
 * Formato: <PREFIJO>-<AÑO>-<SECUENCIA 6 dígitos>  ej. PT-2026-000123
 * - La secuencia viene de un SEQUENCE de PostgreSQL: única y concurrente-segura.
 * - El año facilita al personal ubicar la orden; la unicidad la garantiza la secuencia.
 */
export class WorkOrderCodeFactory {
  static build(prefix: string, date: Date, sequence: number, timeZone = 'America/Guayaquil'): string {
    if (!Number.isInteger(sequence) || sequence <= 0) throw new Error('Secuencia inválida');
    const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(date);
    return `${prefix.toUpperCase()}-${year}-${String(sequence).padStart(6, '0')}`;
  }

  static isValid(code: string): boolean {
    return /^[A-Z0-9]{1,5}-\d{4}-\d{6,}$/.test(code);
  }
}
