/**
 * Objetivo: reglas de formato de los campos del personal en el frontend.
 * Son las mismas del backend (backend/src/common/validation/field-rules.ts):
 * si cambia una, cambie la otra en el mismo PR.
 */
import { z } from 'zod';

export const DOCUMENT_ID_RULE = /^(\d{10}|\d{13})$/;
export const DOCUMENT_ID_MESSAGE = 'Cédula (10 dígitos) o RUC (13 dígitos): sólo números';

export const PHONE_RULE = /^(?=(?:\D*\d){7,15}\D*$)\+?[0-9\s()-]+$/;
export const PHONE_MESSAGE = 'Teléfono inválido: sólo números (7 a 15 dígitos); puede iniciar con +';

export const PERSON_NAME_RULE = /^\p{L}[\p{L}\s.'-]*$/u;
export const PERSON_NAME_MESSAGE = 'El nombre sólo puede tener letras, espacios, punto, apóstrofo o guion';

export const CLIENT_NAME_RULE = /^(?=.*\p{L})[\p{L}\d\s.,'&-]+$/u;
export const CLIENT_NAME_MESSAGE = "El nombre debe tener letras; sólo se permiten letras, números, espacios y . , ' & -";

export const BRAND_MODEL_RULE = /^[\p{L}\d][\p{L}\d\s.,'&/+()#-]*$/u;
export const BRAND_MODEL_MESSAGE = "Sólo letras, números, espacios y . , ' & / + ( ) # -";

export const SERIAL_RULE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
export const SERIAL_MESSAGE = 'Número de serie: letras y números sin espacios (se permiten - _ . /)';

/** Cédula/RUC obligatoria. */
export const documentIdField = z.string().trim().min(1, 'Ingrese la cédula o RUC').regex(DOCUMENT_ID_RULE, DOCUMENT_ID_MESSAGE);

/** Cédula/RUC opcional (vacío permitido). */
export const optionalDocumentIdField = z.string().trim().regex(DOCUMENT_ID_RULE, DOCUMENT_ID_MESSAGE).or(z.literal('')).optional();

/** Teléfono opcional (vacío permitido). */
export const optionalPhoneField = z.string().trim().regex(PHONE_RULE, PHONE_MESSAGE).or(z.literal('')).optional();

/** Nombre de persona obligatorio. */
export const personNameField = (min: number, max: number, required: string) =>
  z.string().trim().min(min, required).max(max, `Máximo ${max} caracteres`).regex(PERSON_NAME_RULE, PERSON_NAME_MESSAGE);
