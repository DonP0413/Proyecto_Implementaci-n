/**
 * Objetivo: validar el tipo REAL de un archivo por sus "magic bytes" y no sólo
 * por el Content-Type enviado por el navegador (que el usuario puede falsear).
 */
export type DetectedFileType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | 'application/zip';

export const detectFileType = (buffer: Buffer): DetectedFileType | null => {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  // DOCX / XLSX son contenedores ZIP
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)
    return 'application/zip';
  return null;
};

export const isPlainText = (buffer: Buffer): boolean => {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  return !sample.includes(0x00);
};

export const extensionFor = (mime: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
  };
  return map[mime] ?? 'bin';
};
