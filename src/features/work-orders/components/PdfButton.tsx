/**
 * Objetivo: botón que genera/descarga un documento PDF protegido de la orden
 * (ingreso, cotización o listo para entregar) y lo abre en una pestaña nueva
 * para imprimirlo o guardarlo.
 */
import { useState, type ReactNode } from 'react';
import { fetchProtectedFile } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { getErrorMessage } from '../../../lib/errors';
import { toast } from '../../../stores/toastStore';

interface PdfButtonProps {
  path: string;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  variant?: 'primary' | 'secondary' | 'success';
  size?: 'sm' | 'md';
}

export function PdfButton({ path, children, disabled, title, variant = 'secondary', size = 'md' }: PdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    // La pestaña se abre YA (dentro del clic) para que el bloqueador de ventanas emergentes no la impida;
    // cuando llega el PDF se muestra en ella. Si el navegador la bloquea, el PDF se descarga.
    const tab = window.open('', '_blank');
    setLoading(true);
    try {
      const { url, filename } = await fetchProtectedFile(path);
      if (tab) {
        tab.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (e) {
      tab?.close();
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant={variant} size={size} loading={loading} disabled={disabled} title={title} onClick={open}>
      📄 {children}
    </Button>
  );
}
