/**
 * Objetivo: selector de archivos con vista previa, límite de cantidad, tipo real y
 * peso máximo (validación temprana en el cliente; el backend vuelve a validar).
 * `capture` permite abrir la cámara del celular/tablet en el mostrador.
 */
import { useEffect, useMemo, useState } from 'react';
import { formatBytes } from '../../../lib/format';
import { convertWebpToJpeg } from '../../../lib/images';
import { toast } from '../../../stores/toastStore';
import { MAX_FILE_MB } from '../constants';

interface Props {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  accept: string;
  maxFiles: number;
  imagesOnly?: boolean;
  hint?: string;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

const hasValidImageSignature = async (file: File): Promise<boolean> => {
  if (typeof file.slice !== 'function') return true;
  const header = file.slice(0, 12);
  if (typeof header.arrayBuffer !== 'function') return true;
  const bytes = new Uint8Array(await header.arrayBuffer());
  if (bytes.length < 12) return false;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const ascii = String.fromCharCode(...bytes);
  const isWebp = ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
  return isJpeg || isPng || isWebp;
};

export function FilePicker({ label, files, onChange, accept, maxFiles, imagesOnly = false, hint }: Props) {
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(
    () => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)),
    [files],
  );
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  const add = async (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const maxBytes = MAX_FILE_MB * 1024 * 1024;
    const errors: string[] = [];
    const valid: File[] = [];

    for (const file of Array.from(list)) {
      if (imagesOnly) {
        const typeOk = ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase());
        const extOk = ALLOWED_IMAGE_EXT.test(file.name);
        if (!typeOk || !extOk) {
          errors.push(`Solo se permiten archivos de fotografía (JPG, PNG o WEBP). "${file.name}" no es válido.`);
          continue;
        }
      }
      if (file.size === 0) {
        errors.push(`El archivo "${file.name}" está vacío.`);
        continue;
      }
      if (file.size > maxBytes) {
        errors.push(`El archivo "${file.name}" (${formatBytes(file.size)}) supera el peso máximo permitido de ${MAX_FILE_MB} MB.`);
        continue;
      }
      if (imagesOnly && !(await hasValidImageSignature(file))) {
        errors.push(`El contenido de "${file.name}" no corresponde a una fotografía válida (JPG, PNG o WEBP).`);
        continue;
      }
      valid.push(imagesOnly ? await convertWebpToJpeg(file) : file);
    }

    if (files.length + valid.length > maxFiles) {
      errors.push(`Máximo ${maxFiles} archivo(s) permitido(s).`);
    }

    if (errors.length > 0) {
      const msg = errors[0];
      setError(msg);
      toast.error(msg);
    }

    const available = Math.max(0, maxFiles - files.length);
    if (valid.length > 0 && available > 0) {
      onChange([...files, ...valid.slice(0, available)]);
    }
  };

  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label>{label}</label>
      <input
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        capture={imagesOnly ? 'environment' : undefined}
        disabled={files.length >= maxFiles}
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = '';
        }}
      />
      <small className="hint">{hint ?? `Opcional · Máximo ${maxFiles} archivo(s) de hasta ${MAX_FILE_MB} MB.`}</small>
      {error && (
        <small className="error-text" role="alert">
          {error}
        </small>
      )}
      {files.length > 0 && (
        <ul className="picker-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              {previews[index] ? (
                <img src={previews[index]!} alt={file.name} />
              ) : (
                <span className="file-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
              )}
              <span className="picker-name">
                {file.name} <small className="muted">({formatBytes(file.size)})</small>
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Quitar ${file.name}`}
                onClick={() => {
                  setError(null);
                  onChange(files.filter((_, i) => i !== index));
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
