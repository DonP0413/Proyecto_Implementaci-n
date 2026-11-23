/**
 * Objetivo: búsquedas sin distinguir tildes, ñ ni mayúsculas.
 * LIKE de SQLite sólo ignora mayúsculas en letras ASCII: "MUÑOZ" no encontraba
 * "Muñoz" y "munoz" tampoco. Se registra en la conexión una función SQL que
 * normaliza ambos lados de la comparación: pt_norm(columna) LIKE pt_norm(:texto).
 */

/** Nombre de la función SQL registrada en la conexión SQLite. */
export const SEARCH_NORMALIZE_FN = 'pt_norm';

/** "Ángela MUÑOZ" -> "angela munoz" (quita tildes y diéresis; ñ -> n; minúsculas). */
export const normalizeForSearch = (value: unknown): string | null =>
  value === null || value === undefined
    ? null
    : String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Expresión SQL de comparación normalizada para el QueryBuilder. */
export const normalizedLike = (column: string, param: string, escape: string): string =>
  `${SEARCH_NORMALIZE_FN}(${column}) LIKE ${SEARCH_NORMALIZE_FN}(:${param}) ${escape}`;
