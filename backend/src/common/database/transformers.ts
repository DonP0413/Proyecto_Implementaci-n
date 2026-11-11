/**
 * Objetivo: transformar NUMERIC de PostgreSQL (llega como string desde `pg`
 * para no perder precisión) a number en la entidad. Los montos tienen 2
 * decimales y máximo 10 dígitos, rango seguro para number de JS.
 */
import type { ValueTransformer } from 'typeorm';

export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
};
