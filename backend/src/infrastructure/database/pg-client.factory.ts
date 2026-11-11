/**
 * Objetivo: crear un cliente `pg` a partir de las variables de entorno para
 * los comandos CLI (migrate / seed), que corren fuera del contenedor de Nest.
 */
import { Client } from 'pg';

export const createPgClientFromEnv = (): Client =>
  new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    application_name: 'pintotech-cli',
  });
