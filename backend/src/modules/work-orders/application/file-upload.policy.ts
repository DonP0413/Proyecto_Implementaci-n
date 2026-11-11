/**
 * Objetivo: política de validación de archivos subidos (seguridad).
 *  - Lista blanca de tipos por categoría (fotos: sólo imágenes).
 *  - Verificación por "magic bytes": el contenido debe coincidir con el tipo declarado.
 *  - Nombre original saneado (sólo se guarda como metadato; nunca como ruta).
 */
import { InvalidInputError } from '../../../common/errors/domain.errors';
import { detectFileType, extensionFor, isPlainText } from '../../../common/utils/file-signature';
import { AttachmentCategory, DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES } from '../domain/work-order.enums';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ValidatedFile {
  originalName: string;
  mimeType: string;
  extension: string;
  buffer: Buffer;
  size: number;
}

const ZIP_BASED = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFC')
    .replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, '_')
    .slice(0, 200) || 'archivo';

export class FileUploadPolicy {
  static allowedFor(category: AttachmentCategory): readonly string[] {
    return category === AttachmentCategory.TECHNICAL_DOCUMENT ? DOCUMENT_MIME_TYPES : IMAGE_MIME_TYPES;
  }

  static validate(file: UploadedFileLike, category: AttachmentCategory): ValidatedFile {
    const allowed = FileUploadPolicy.allowedFor(category);
    const declared = file.mimetype.toLowerCase();
    if (!allowed.includes(declared)) {
      throw new InvalidInputError(
        `Tipo de archivo no permitido: ${file.originalname} (${declared})`,
        'FILE_TYPE_NOT_ALLOWED',
        {
          allowed,
        },
      );
    }
    if (!file.buffer || file.size === 0)
      throw new InvalidInputError(`Archivo vacío: ${file.originalname}`, 'EMPTY_FILE');

    const detected = detectFileType(file.buffer);
    const matches =
      (ZIP_BASED.has(declared) && detected === 'application/zip') ||
      (declared === 'text/plain' && detected === null && isPlainText(file.buffer)) ||
      detected === declared;
    if (!matches) {
      throw new InvalidInputError(
        `El contenido de ${file.originalname} no corresponde a su tipo declarado`,
        'FILE_SIGNATURE_MISMATCH',
      );
    }
    return {
      originalName: sanitizeFileName(file.originalname),
      mimeType: declared,
      extension: extensionFor(declared),
      buffer: file.buffer,
      size: file.size,
    };
  }
}
