/**
 * Objetivo: ejecutor de migraciones SQL versionadas (estilo Flyway).
 * - Lee archivos V<n>__<descripcion>.sql en orden numérico.
 * - Registra cada versión aplicada en schema_migrations con su checksum SHA-256.
 * - Si un archivo ya aplicado fue modificado, ABORTA (las migraciones son
 *   inmutables; para cambiar algo se crea una nueva versión).
 * - Cada migración corre en su propia transacción y se usa un advisory lock
 *   para que dos réplicas del backend no migren a la vez.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Client } from 'pg';

const MIGRATION_PATTERN = /^V(\d+)__[\w-]+\.sql$/;
const ADVISORY_LOCK_KEY = 72_746_801;

export interface MigrationFile {
  version: number;
  name: string;
  sql: string;
  checksum: string;
}

export const loadMigrations = async (dir: string): Promise<MigrationFile[]> => {
  const entries = await fs.readdir(dir);
  const files = entries.filter((file) => MIGRATION_PATTERN.test(file));
  const migrations = await Promise.all(
    files.map(async (name) => {
      const sql = await fs.readFile(path.join(dir, name), 'utf8');
      return {
        version: Number(MIGRATION_PATTERN.exec(name)![1]),
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
  const sorted = migrations.sort((a, b) => a.version - b.version);
  sorted.forEach((migration, index) => {
    if (index > 0 && sorted[index - 1].version === migration.version) {
      throw new Error(`Versión de migración duplicada: V${migration.version}`);
    }
  });
  return sorted;
};

export const runMigrations = async (
  client: Client,
  dir: string,
  log: (message: string) => void = () => undefined,
): Promise<string[]> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER      PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      checksum    VARCHAR(64)  NOT NULL,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`);

  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  const applied: string[] = [];
  try {
    const migrations = await loadMigrations(dir);
    const { rows } = await client.query<{ version: number; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations',
    );
    const done = new Map(rows.map((row) => [row.version, row.checksum]));

    for (const migration of migrations) {
      const previousChecksum = done.get(migration.version);
      if (previousChecksum) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `La migración ${migration.name} fue modificada después de aplicarse. Cree una nueva versión.`,
          );
        }
        continue;
      }
      log(`Aplicando ${migration.name}...`);
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [
          migration.version,
          migration.name,
          migration.checksum,
        ]);
        await client.query('COMMIT');
        applied.push(migration.name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falló ${migration.name}: ${(error as Error).message}`);
      }
    }
    log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Esquema al día, nada que migrar.');
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
};
