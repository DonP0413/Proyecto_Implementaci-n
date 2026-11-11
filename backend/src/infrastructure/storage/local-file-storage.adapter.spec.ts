import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { LocalFileStorageAdapter } from './local-file-storage.adapter';

describe('LocalFileStorageAdapter', () => {
  const storage = new LocalFileStorageAdapter(mkdtempSync(path.join(tmpdir(), 'storage-')));

  it('guarda, lee y elimina un archivo', async () => {
    const stored = await storage.save(Buffer.from('contenido'), {
      folder: 'work-orders/abc',
      extension: 'txt',
    });
    expect(stored.key).toMatch(/^work-orders\/abc\/[0-9a-f-]+\.txt$/);
    expect((await storage.read(stored.key)).toString()).toBe('contenido');
    await storage.delete(stored.key);
    await expect(storage.read(stored.key)).rejects.toThrow();
  });

  it('bloquea path traversal', async () => {
    await expect(storage.read('../../etc/passwd')).rejects.toThrow('inválida');
  });

  it('sanea carpetas y extensiones', async () => {
    const stored = await storage.save(Buffer.from('x'), { folder: '../../evil', extension: 'p/h.p' });
    expect(stored.key.startsWith('..')).toBe(false);
    expect(stored.key.endsWith('.php')).toBe(true);
  });
});
