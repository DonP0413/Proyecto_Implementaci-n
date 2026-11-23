/**
 * Objetivo: manejo centralizado de errores. Convierte cualquier excepción en
 * una respuesta JSON homogénea { statusCode, code, message, details, path,
 * requestId, timestamp }, registra en log los errores 5xx con stack y nunca
 * filtra detalles internos (SQL, stack) al cliente.
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { DomainError } from '../errors/domain.errors';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: unknown;
  path: string;
  requestId?: string;
  timestamp: string;
}

/** Códigos de error de SQLite (better-sqlite3) que se traducen a respuestas 4xx. */
const DB_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  SQLITE_CONSTRAINT_UNIQUE: {
    status: 409,
    code: 'DUPLICATE_VALUE',
    message: 'Ya existe un registro con esos datos',
  },
  SQLITE_CONSTRAINT_PRIMARYKEY: {
    status: 409,
    code: 'DUPLICATE_VALUE',
    message: 'Ya existe un registro con esos datos',
  },
  SQLITE_CONSTRAINT_FOREIGNKEY: {
    status: 409,
    code: 'FOREIGN_KEY_VIOLATION',
    message: 'El registro está relacionado con otros datos',
  },
  SQLITE_CONSTRAINT_CHECK: {
    status: 422,
    code: 'CHECK_VIOLATION',
    message: 'Los datos no cumplen las reglas de integridad',
  },
  SQLITE_CONSTRAINT_NOTNULL: {
    status: 422,
    code: 'CHECK_VIOLATION',
    message: 'Los datos no cumplen las reglas de integridad',
  },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const body: ErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      path: request.originalUrl ?? request.url,
      requestId: request.id ? String(request.id) : undefined,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof DomainError) {
      body.statusCode = exception.httpStatus;
      body.code = exception.code;
      body.message = exception.message;
      body.details = exception.details;
    } else if (exception instanceof HttpException) {
      body.statusCode = exception.getStatus();
      body.code = HttpStatus[body.statusCode] ?? 'HTTP_ERROR';
      const res = exception.getResponse();
      const rawMessage =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ?? exception.message);
      if (body.statusCode === HttpStatus.PAYLOAD_TOO_LARGE || rawMessage === 'File too large') {
        body.code = 'FILE_TOO_LARGE';
        body.message = 'El archivo supera el peso máximo permitido (8 MB)';
      } else if (rawMessage === 'Too many files') {
        body.code = 'TOO_MANY_FILES';
        body.message = 'Se superó la cantidad máxima de archivos permitidos';
      } else {
        body.message = rawMessage;
      }
    } else if (exception instanceof QueryFailedError) {
      const driverError = (exception as QueryFailedError & { driverError?: { code?: string } }).driverError;
      const mapped = driverError?.code ? DB_ERROR_MAP[driverError.code] : undefined;
      if (mapped) {
        body.statusCode = mapped.status;
        body.code = mapped.code;
        body.message = mapped.message;
      }
    }

    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId: body.requestId, path: body.path },
        exception instanceof Error ? exception.message : 'Unknown error',
      );
    } else {
      this.logger.warn({ requestId: body.requestId, path: body.path, code: body.code }, String(body.message));
    }

    response.status(body.statusCode).json(body);
  }
}
