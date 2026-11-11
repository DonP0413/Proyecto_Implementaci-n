/** Objetivo: renderizar la cola de toasts (región aria-live para lectores de pantalla). */
import { useToastStore } from '../../stores/toastStore';

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span>{t.message}</span>
          <button type="button" className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Cerrar notificación">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
