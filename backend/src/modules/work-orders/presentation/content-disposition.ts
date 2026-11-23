/** Objetivo: construir Content-Disposition seguro (RFC 6266 / 5987) para descargas. */
const INLINE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const contentDisposition = (filename: string, mimeType: string): string => {
  const type = INLINE_TYPES.includes(mimeType) ? 'inline' : 'attachment';
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};
