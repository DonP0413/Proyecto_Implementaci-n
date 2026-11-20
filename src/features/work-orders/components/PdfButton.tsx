/**
 * Objetivo: botón que genera/descarga un documento PDF protegido de la orden
 * (ingreso, cotización o listo para entregar) y lo abre en una pestaña nueva
 * para imprimirlo o guardarlo.
 */
import { useState, type ReactNode } from 'react';
import { openProtectedFile } from '../../../api/endpoints';
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
    // openProtectedFile abre la pestaña dentro del clic y carga el PDF con su URL real
    // (nombre claro y extensión .pdf al guardarlo). Si el navegador la bloquea, lo descarga.
    setLoading(true);
    try {
      await openProtectedFile(path);
    } catch (e) {
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
