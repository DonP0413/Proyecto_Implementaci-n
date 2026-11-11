/**
 * Objetivo: validar las variables de entorno al arrancar (fail-fast). Si falta
 * un secreto o un valor es inválido, la app NO inicia y el log indica cuál.
 */
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  APP_PUBLIC_URL: Joi.string().uri().default('http://localhost:5173'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DB_LOGGING: Joi.boolean().default(false),
  MIGRATIONS_DIR: Joi.string().optional(),

  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET debe tener al menos 32 caracteres',
  }),
  JWT_EXPIRES_IN: Joi.string().default('8h'),

  MAIL_DRIVER: Joi.string().valid('console', 'mailgun').default('console'),
  MAIL_FROM: Joi.string().required(),
  MAIL_REPLY_TO: Joi.string()
    .email({ tlds: { allow: false } })
    .allow('')
    .optional(),
  MAILGUN_API_KEY: Joi.when('MAIL_DRIVER', {
    is: 'mailgun',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  MAILGUN_DOMAIN: Joi.when('MAIL_DRIVER', {
    is: 'mailgun',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  MAILGUN_REGION: Joi.string().valid('us', 'eu').default('us'),
  MAILGUN_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),

  NOTIFICATIONS_WORKER_ENABLED: Joi.boolean().default(true),
  NOTIFICATIONS_POLL_INTERVAL_MS: Joi.number().integer().min(1000).default(15000),
  NOTIFICATIONS_BATCH_SIZE: Joi.number().integer().min(1).max(100).default(10),
  NOTIFICATIONS_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  NOTIFICATIONS_BASE_DELAY_SECONDS: Joi.number().integer().min(1).default(30),
  NOTIFICATIONS_STUCK_AFTER_MINUTES: Joi.number().integer().min(1).default(10),
  NOTIFICATIONS_MAX_EMAIL_PHOTOS: Joi.number().integer().min(0).max(6).default(3),

  STORAGE_DRIVER: Joi.string().valid('local').default('local'),
  STORAGE_LOCAL_PATH: Joi.string().optional(),
  UPLOAD_MAX_FILE_SIZE_MB: Joi.number().integer().min(1).max(25).default(8),
  UPLOAD_MAX_FILES: Joi.number().integer().min(1).max(20).default(6),

  COMPANY_NAME: Joi.string().default('PINTOTECH'),
  COMPANY_ADDRESS: Joi.string().allow('').optional(),
  COMPANY_PHONE: Joi.string().allow('').optional(),
  COMPANY_EMAIL: Joi.string().allow('').optional(),
  COMPANY_WEBSITE: Joi.string().allow('').optional(),
  WORK_ORDER_PREFIX: Joi.string().alphanum().max(5).default('PT'),
  APP_TIMEZONE: Joi.string().default('America/Guayaquil'),

  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
  METRICS_TOKEN: Joi.string().allow('').optional(),

  ADMIN_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .optional(),
  ADMIN_PASSWORD: Joi.string().min(8).optional(),
  ADMIN_NAME: Joi.string().optional(),
});
