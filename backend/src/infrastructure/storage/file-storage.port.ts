/**
 * Objetivo: PUERTO (arquitectura hexagonal) de almacenamiento de archivos.
 * La aplicación sólo conoce esta interfaz; hoy el adaptador es disco local
 * (volumen Docker) y mañana puede ser S3/MinIO/Azure Blob sin tocar los
 * casos de uso (Strategy + Dependency Inversion).
 */
import type { Readable } from 'node:stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface StoredFile {
  key: string;
  sizeBytes: number;
}

export interface FileStorage {
  save(content: Buffer, options: { folder: string; extension: string }): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  stream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  healthCheck(): Promise<void>;
}
