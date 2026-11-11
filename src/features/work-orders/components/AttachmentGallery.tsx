/** Objetivo: galería de fotos y lista de documentos adjuntos (descarga autenticada). */
import { openProtectedFile } from '../../../api/endpoints';
import type { Attachment } from '../../../api/types';
import { AuthImage } from '../../../components/AuthImage';
import { getErrorMessage } from '../../../lib/errors';
import { formatBytes, formatDateTime } from '../../../lib/format';
import { toast } from '../../../stores/toastStore';

const CATEGORY_LABELS: Record<Attachment['category'], string> = {
  RECEPTION_PHOTO: 'Foto de recepción',
  DELIVERY_PHOTO: 'Foto de entrega',
  TECHNICAL_DOCUMENT: 'Documento técnico',
  RECEIPT_PDF: 'Comprobante de ingreso',
};

export function AttachmentGallery({ attachments, emptyText = 'Sin adjuntos' }: { attachments: Attachment[]; emptyText?: string }) {
  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const files = attachments.filter((a) => !a.mimeType.startsWith('image/'));

  const open = (path: string) => openProtectedFile(path).catch((e) => toast.error(getErrorMessage(e)));

  if (attachments.length === 0) return <p className="muted">{emptyText}</p>;
  return (
    <div className="attachments">
      {images.length > 0 && (
        <div className="gallery">
          {images.map((img) => (
            <button key={img.id} type="button" className="gallery-item" onClick={() => open(img.downloadPath)} title="Abrir en tamaño completo">
              <AuthImage path={img.downloadPath} alt={`${CATEGORY_LABELS[img.category]} - ${img.originalName}`} />
              <span className="gallery-caption">{CATEGORY_LABELS[img.category]}</span>
            </button>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id}>
              <button type="button" className="link-btn" onClick={() => open(file.downloadPath)}>
                {file.originalName}
              </button>
              <small className="muted">
                {CATEGORY_LABELS[file.category]} · {formatBytes(file.sizeBytes)} · {formatDateTime(file.createdAt)}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
