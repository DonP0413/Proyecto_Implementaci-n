/**
 * Objetivo: selector de archivos con vista previa, límite de cantidad y de
 * tamaño (validación temprana en el cliente; el backend vuelve a validar).
 * `capture` permite abrir la cámara del celular/tablet en el mostrador.
 */
import { useEffect, useMemo } from 'react';
import { formatBytes } from '../../../lib/format';
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

export function FilePicker({ label, files, onChange, accept, maxFiles, imagesOnly = false, hint }: Props) {
  const previews = useMemo(
    () => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)),
    [files],
  );
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const valid = Array.from(list).filter((file) => {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        window.alert(`"${file.name}" supera ${MAX_FILE_MB} MB`);
        return false;
      }
      if (imagesOnly && !file.type.startsWith('image/')) return false;
      return true;
    });
    onChange([...files, ...valid].slice(0, maxFiles));
  };

  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        capture={imagesOnly ? 'environment' : undefined}
        disabled={files.length >= maxFiles}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      <small className="hint">{hint ?? `Máximo ${maxFiles} archivo(s) de hasta ${MAX_FILE_MB} MB.`}</small>
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
              <button type="button" className="icon-btn" aria-label={`Quitar ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
