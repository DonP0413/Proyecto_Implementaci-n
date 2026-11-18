/**
 * Objetivo: centralizar y tipar TODA la configuración de la aplicación a partir
 * de variables de entorno (12-Factor App, factor III). Ningún módulo debe leer
 * process.env directamente: se inyecta ConfigService y se usan estas claves.
 */
import * as path from 'node:path';

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : ['true', '1', 'yes'].includes(value.toLowerCase());

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  swaggerEnabled: bool(process.env.SWAGGER_ENABLED, true),
  appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:5173',

  database: {
    /** Archivo SQLite local. Relativo a la carpeta desde la que se inicia el backend. */
    path: path.resolve(process.cwd(), process.env.DB_PATH ?? path.join('data', 'pintotech.sqlite')),
    logging: bool(process.env.DB_LOGGING, false),
    migrationsDir: process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), '..', 'database', 'migrations'),
  },

  /** Carpeta con la SPA compilada (npm run build en la raíz). Si existe, el backend la sirve. */
  frontendDist: process.env.FRONTEND_DIST ?? path.resolve(process.cwd(), '..', 'dist'),

  /** Administrador inicial: se crea al arrancar si la base no tiene usuarios. */
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME ?? 'Administrador',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },

  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? path.resolve(process.cwd(), 'storage'),
  },

  uploads: {
    maxFileSizeMb: int(process.env.UPLOAD_MAX_FILE_SIZE_MB, 8),
    maxFiles: int(process.env.UPLOAD_MAX_FILES, 6),
  },

  company: {
    name: process.env.COMPANY_NAME ?? 'PINTOTECH',
    address: process.env.COMPANY_ADDRESS ?? '',
    phone: process.env.COMPANY_PHONE ?? '',
    email: process.env.COMPANY_EMAIL ?? '',
    website: process.env.COMPANY_WEBSITE ?? '',
  },

  workOrders: {
    codePrefix: process.env.WORK_ORDER_PREFIX ?? 'PT',
    timezone: process.env.APP_TIMEZONE ?? 'America/Guayaquil',
  },

  throttle: {
    ttlMs: int(process.env.THROTTLE_TTL_MS, 60000),
    limit: int(process.env.THROTTLE_LIMIT, 120),
  },

  metrics: {
    token: process.env.METRICS_TOKEN ?? '',
  },
});

export type AppConfiguration = ReturnType<typeof configuration>;
