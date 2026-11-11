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
    host: process.env.DB_HOST ?? 'localhost',
    port: int(process.env.DB_PORT, 5432),
    user: process.env.DB_USER ?? 'pintotech',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'pintotech',
    ssl: bool(process.env.DB_SSL, false),
    poolMax: int(process.env.DB_POOL_MAX, 10),
    logging: bool(process.env.DB_LOGGING, false),
    migrationsDir: process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), '..', 'database', 'migrations'),
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },

  mail: {
    driver: (process.env.MAIL_DRIVER ?? 'console') as 'console' | 'mailgun',
    from: process.env.MAIL_FROM ?? 'PINTOTECH <no-reply@example.com>',
    replyTo: process.env.MAIL_REPLY_TO ?? '',
    mailgun: {
      apiKey: process.env.MAILGUN_API_KEY ?? '',
      domain: process.env.MAILGUN_DOMAIN ?? '',
      region: (process.env.MAILGUN_REGION ?? 'us') as 'us' | 'eu',
      timeoutMs: int(process.env.MAILGUN_TIMEOUT_MS, 15000),
    },
  },

  notifications: {
    workerEnabled: bool(process.env.NOTIFICATIONS_WORKER_ENABLED, true),
    pollIntervalMs: int(process.env.NOTIFICATIONS_POLL_INTERVAL_MS, 15000),
    batchSize: int(process.env.NOTIFICATIONS_BATCH_SIZE, 10),
    maxAttempts: int(process.env.NOTIFICATIONS_MAX_ATTEMPTS, 5),
    baseDelaySeconds: int(process.env.NOTIFICATIONS_BASE_DELAY_SECONDS, 30),
    stuckAfterMinutes: int(process.env.NOTIFICATIONS_STUCK_AFTER_MINUTES, 10),
    maxEmailPhotos: int(process.env.NOTIFICATIONS_MAX_EMAIL_PHOTOS, 3),
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
