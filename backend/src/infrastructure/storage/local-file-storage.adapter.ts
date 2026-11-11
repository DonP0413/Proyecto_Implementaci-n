/**
 * Objetivo: ADAPTADOR de almacenamiento en disco local.
 * - Nombres de archivo aleatorios (UUID): nunca se usa el nombre original
 *   para escribir en disco (evita colisiones y path traversal).
 * - Toda ruta resuelta se verifica dentro del directorio base.
 */
import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Readable } from 'node:stream';
import type { FileStorage, StoredFile } from './file-storage.port';

export class LocalFileStorageAdapter implements FileStorage {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  async save(content: Buffer, options: { folder: string; extension: string }): Promise<StoredFile> {
    const safeFolder = options.folder
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .split('/')
      .filter(Boolean)
      .join('/');
    const safeExt = options.extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const key = path.posix.join(safeFolder, `${randomUUID()}.${safeExt}`);
    const fullPath = this.resolve(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, { flag: 'wx' });
    return { key, sizeBytes: content.length };
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async stream(key: string): Promise<Readable> {
    const fullPath = this.resolve(key);
    await fs.access(fullPath);
    return createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async healthCheck(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const probe = path.join(this.baseDir, `.health-${randomUUID()}`);
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe, { force: true });
  }

  private resolve(key: string): string {
    const fullPath = path.resolve(this.baseDir, key);
    if (!fullPath.startsWith(this.baseDir + path.sep)) {
      throw new Error(`Clave de almacenamiento inválida: ${key}`);
    }
    return fullPath;
  }
}
