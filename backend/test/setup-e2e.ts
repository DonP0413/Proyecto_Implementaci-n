/**
 * Objetivo: variables de entorno por defecto para las pruebas e2e. Se carga
 * ANTES de importar AppModule (ConfigModule valida el entorno al importarse).
 * En CI, los valores reales llegan desde el workflow.
 */
import * as path from 'node:path';

process.env.NODE_ENV ??= 'test';
process.env.MAIL_DRIVER = 'console';
process.env.NOTIFICATIONS_WORKER_ENABLED = 'false';
process.env.SWAGGER_ENABLED = 'false';
process.env.LOG_LEVEL ??= 'warn';
process.env.JWT_SECRET ??= 'e2e-secret-e2e-secret-e2e-secret-1234';
process.env.MAIL_FROM ??= 'PINTOTECH <no-reply@pintotech.test>';
process.env.STORAGE_LOCAL_PATH ??= path.resolve(__dirname, '..', 'storage-e2e');
process.env.DB_HOST ??= 'localhost';
process.env.DB_USER ??= 'pintotech';
process.env.DB_PASSWORD ??= 'pintotech';
process.env.DB_NAME ??= 'pintotech_test';
