/**
 * Objetivo: reglas de formato de los campos que ingresa el personal (cédula/RUC,
 * teléfono, nombres, marca, modelo y serie). Un solo lugar para que todos los
 * DTOs validen igual; el frontend replica estas reglas en src/lib/validation.ts.
 */

/** Cédula ecuatoriana (10 dígitos) o RUC (13 dígitos). Sólo números. */
export const DOCUMENT_ID_RULE = /^(\d{10}|\d{13})$/;
export const DOCUMENT_ID_MESSAGE = 'Cédula (10 dígitos) o RUC (13 dígitos): sólo números';

/** Entre 7 y 15 dígitos; se permiten espacios, guiones, paréntesis y un "+" inicial. */
export const PHONE_RULE = /^(?=(?:\D*\d){7,15}\D*$)\+?[0-9\s()-]+$/;
export const PHONE_MESSAGE = 'Teléfono inválido: sólo números (7 a 15 dígitos); puede iniciar con +';

/** Nombre de una persona: letras (con tildes y ñ), espacios, punto, apóstrofo o guion. */
export const PERSON_NAME_RULE = /^\p{L}[\p{L}\s.'-]*$/u;
export const PERSON_NAME_MESSAGE = 'El nombre sólo puede tener letras, espacios, punto, apóstrofo o guion';

/** Nombre del cliente (persona o empresa): debe tener letras; admite números y . , ' & - */
export const CLIENT_NAME_RULE = /^(?=.*\p{L})[\p{L}\d\s.,'&-]+$/u;
export const CLIENT_NAME_MESSAGE =
  "El nombre debe tener letras; sólo se permiten letras, números, espacios y . , ' & -";

/** Marca o modelo: letras, números, espacios y . , ' & / + ( ) # - */
export const BRAND_MODEL_RULE = /^[\p{L}\d][\p{L}\d\s.,'&/+()#-]*$/u;
export const BRAND_MODEL_MESSAGE = "Sólo letras, números, espacios y . , ' & / + ( ) # -";

/** Número de serie: letras y números sin espacios; se permiten - _ . / */
export const SERIAL_RULE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
export const SERIAL_MESSAGE = 'Número de serie: letras y números sin espacios (se permiten - _ . /)';
