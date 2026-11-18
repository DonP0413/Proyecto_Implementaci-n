/**
 * Objetivo: variables de entorno por defecto para las pruebas e2e. Se carga
 * ANTES de importar AppModule (ConfigModule valida el entorno al importarse).
 * Cada ejecución usa una base SQLite nueva en una carpeta temporal.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

const tmp = mkdtempSync(path.join(tmpdir(), 'pintotech-e2e-'));

process.env.NODE_ENV ??= 'test';
process.env.SWAGGER_ENABLED = 'false';
process.env.LOG_LEVEL ??= 'warn';
process.env.JWT_SECRET ??= 'e2e-secret-e2e-secret-e2e-secret-1234';
process.env.STORAGE_LOCAL_PATH = path.join(tmp, 'storage');
process.env.DB_PATH = path.join(tmp, 'e2e.sqlite');
process.env.MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'database', 'migrations');
process.env.ADMIN_EMAIL = 'e2e-admin@pintotech.test';
process.env.ADMIN_PASSWORD = 'E2eClave2026';
process.env.ADMIN_NAME = 'E2E Admin';
