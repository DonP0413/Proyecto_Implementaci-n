/**
 * Objetivo: comando `npm run migrate` / `npm run migrate:prod`.
 * Aplica las migraciones SQL pendientes y termina con código 0/1 para que el
 * pipeline o el entrypoint de Docker puedan detener el despliegue si falla.
 */
import * as path from 'node:path';
import { createPgClientFromEnv } from './pg-client.factory';
import { runMigrations } from './migration-runner';

const main = async (): Promise<void> => {
  const dir = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), '..', 'database', 'migrations');
  const client = createPgClientFromEnv();
  await client.connect();
  try {
    console.log(`[migrate] Directorio: ${dir}`);
    await runMigrations(client, dir, (msg) => console.log(`[migrate] ${msg}`));
  } finally {
    await client.end();
  }
};

main().catch((error: Error) => {
  console.error(`[migrate] ERROR: ${error.message}`);
  process.exit(1);
});
