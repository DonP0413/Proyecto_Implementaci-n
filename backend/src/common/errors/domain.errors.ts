/**
 * Objetivo: jerarquía de errores de dominio independiente de HTTP.
 * La capa de aplicación lanza estos errores y el AllExceptionsFilter los
 * traduce a códigos HTTP. Así el dominio no depende de NestJS (Clean Architecture).
 */
export abstract class DomainError extends Error {
  abstract readonly httpStatus: number;

  protected constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor(entity: string, identifier: string) {
    super(`${entity} no encontrado (${identifier})`, 'NOT_FOUND', { entity, identifier });
  }
}

export class BusinessRuleError extends DomainError {
  readonly httpStatus = 422;
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION', details?: Record<string, unknown>) {
    super(message, code, details);
  }
}

export class ConflictError extends DomainError {
  readonly httpStatus = 409;
  constructor(message: string, code = 'CONFLICT', details?: Record<string, unknown>) {
    super(message, code, details);
  }
}

export class InvalidInputError extends DomainError {
  readonly httpStatus = 400;
  constructor(message: string, code = 'INVALID_INPUT', details?: Record<string, unknown>) {
    super(message, code, details);
  }
}

export class UnauthorizedError extends DomainError {
  readonly httpStatus = 401;
  constructor(message = 'Credenciales inválidas', code = 'UNAUTHORIZED') {
    super(message, code);
  }
}

export class ForbiddenError extends DomainError {
  readonly httpStatus = 403;
  constructor(message = 'No tiene permisos para realizar esta acción', code = 'FORBIDDEN') {
    super(message, code);
  }
}
