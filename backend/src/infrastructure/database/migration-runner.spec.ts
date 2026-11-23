import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { loadMigrations } from './migration-runner';

describe('loadMigrations', () => {
  it('ordena por versión numérica e ignora archivos ajenos', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mig-'));
    writeFileSync(path.join(dir, 'V10__diez.sql'), 'SELECT 10;');
    writeFileSync(path.join(dir, 'V2__dos.sql'), 'SELECT 2;');
    writeFileSync(path.join(dir, 'README.md'), '# no es migración');

    const migrations = await loadMigrations(dir);

    expect(migrations.map((m) => m.version)).toEqual([2, 10]);
    expect(migrations[0].checksum).toHaveLength(64);
  });

  it('falla con versiones duplicadas', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mig-'));
    writeFileSync(path.join(dir, 'V1__a.sql'), 'SELECT 1;');
    writeFileSync(path.join(dir, 'V1__b.sql'), 'SELECT 1;');
    await expect(loadMigrations(dir)).rejects.toThrow('duplicada');
  });
});
