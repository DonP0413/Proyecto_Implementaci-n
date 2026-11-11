/**
 * Objetivo: mostrar imágenes protegidas por JWT. <img src> no envía el
 * header Authorization, así que se descarga como Blob y se usa un Object URL
 * (se libera al desmontar para no fugar memoria).
 */
import { useEffect, useState } from 'react';
import { http } from '../api/http';

export function AuthImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    http
      .get<Blob>(path, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed) return <div className={`img-placeholder ${className ?? ''}`}>Imagen no disponible</div>;
  if (!src) return <div className={`img-placeholder ${className ?? ''}`}>Cargando…</div>;
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
