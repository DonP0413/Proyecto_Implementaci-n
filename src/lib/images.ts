/** Objetivo: utilidades de imágenes en el navegador (conversión antes de subir fotos). */

/**
 * Las fotos WEBP se convierten a JPG antes de subirlas: los PDF para el cliente
 * sólo pueden incluir JPG o PNG. Si el navegador no puede convertirla, se sube tal cual
 * (el PDF la omite con una nota y queda como adjunto).
 */
export const convertWebpToJpeg = async (file: File): Promise<File> => {
  if (file.type.toLowerCase() !== 'image/webp' || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#ffffff'; // fondo blanco para las zonas transparentes
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.webp$/i, '.jpg'), { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
};
