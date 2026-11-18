/**
 * Objetivo: preparar la base de datos SQLite local ANTES de que TypeORM se
 * conecte: crea la carpeta del archivo, aplica las migraciones pendientes y
 * crea el administrador inicial si todavía no existe ningún usuario.
 * Así basta con iniciar la aplicación (iniciar.bat) para tenerla lista.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import * as path from 'node:path';
import * as bcrypt from 'bcryptjs';
import BetterSqlite3 from 'better-sqlite3';
import { runMigrations } from './migration-runner';

export interface AdminSeed {
  email?: string;
  password?: string;
  name?: string;
}

export const prepareDatabase = async (
  dbPath: string,
  migrationsDir: string,
  admin: AdminSeed,
  log: (message: string) => void = () => undefined,
): Promise<void> => {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    await runMigrations(db, migrationsDir, (msg) => log(`[migrate] ${msg}`));
    seedAdmin(db, admin, log);
  } finally {
    db.close();
  }
};

const seedAdmin = (db: BetterSqlite3.Database, admin: AdminSeed, log: (message: string) => void): void => {
  const { total } = db.prepare('SELECT count(*) AS total FROM users').get() as { total: number };
  if (total > 0) return;
  if (!admin.email || !admin.password) {
    log('[seed] No hay usuarios: defina ADMIN_EMAIL y ADMIN_PASSWORD para crear el administrador inicial.');
    return;
  }
  db.prepare(
    `INSERT INTO users (id, full_name, email, password_hash, role) VALUES (?, ?, lower(?), ?, 'ADMIN')`,
  ).run(randomUUID(), admin.name ?? 'Administrador', admin.email, bcrypt.hashSync(admin.password, 12));
  log(`[seed] Administrador ${admin.email} creado.`);
};
