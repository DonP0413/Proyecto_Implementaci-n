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

  DB_PATH: Joi.string().optional(),
  DB_LOGGING: Joi.boolean().default(false),
  MIGRATIONS_DIR: Joi.string().optional(),
  FRONTEND_DIST: Joi.string().optional(),

  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET debe tener al menos 32 caracteres',
  }),
  JWT_EXPIRES_IN: Joi.string().default('8h'),

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

  // Usuario del administrador inicial. ADMIN_EMAIL sólo se acepta por compatibilidad
  // con configuraciones anteriores (mismo significado).
  ADMIN_USER: Joi.string()
    .pattern(/^[a-zA-Z0-9._@-]{3,60}$/)
    .optional(),
  ADMIN_EMAIL: Joi.string()
    .pattern(/^[a-zA-Z0-9._@-]{3,60}$/)
    .optional(),
  ADMIN_PASSWORD: Joi.string().min(8).optional(),
  ADMIN_NAME: Joi.string().optional(),
});
