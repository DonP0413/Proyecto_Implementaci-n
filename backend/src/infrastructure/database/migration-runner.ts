/**
 * Objetivo: ejecutor de migraciones SQL versionadas (estilo Flyway) para SQLite.
 * - Lee archivos V<n>__<descripcion>.sql en orden numérico.
 * - Registra cada versión aplicada en schema_migrations con su checksum SHA-256.
 * - Si un archivo ya aplicado fue modificado, ABORTA (las migraciones son
 *   inmutables; para cambiar algo se crea una nueva versión).
 * - Cada migración corre en su propia transacción.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Database } from 'better-sqlite3';

const MIGRATION_PATTERN = /^V(\d+)__[\w-]+\.sql$/;

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
  db: Database,
  dir: string,
  log: (message: string) => void = () => undefined,
): Promise<string[]> => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER      PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      checksum    VARCHAR(64)  NOT NULL,
      applied_at  DATETIME     NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
    )`);

  const migrations = await loadMigrations(dir);
  const rows = db.prepare('SELECT version, checksum FROM schema_migrations').all() as Array<{
    version: number;
    checksum: string;
  }>;
  const done = new Map(rows.map((row) => [row.version, row.checksum]));
  const insert = db.prepare('INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)');
  const applied: string[] = [];

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
      db.transaction(() => {
        db.exec(migration.sql);
        insert.run(migration.version, migration.name, migration.checksum);
      })();
      applied.push(migration.name);
    } catch (error) {
      throw new Error(`Falló ${migration.name}: ${(error as Error).message}`);
    }
  }
  log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Esquema al día, nada que migrar.');
  return applied;
};
