/** Objetivo: paginación simple para listados. */
import { Button } from './Button';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onChange }: Props) {
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="muted">
        {total} resultado{total === 1 ? '' : 's'} · Página {page} de {totalPages}
      </span>
      <div className="pagination-buttons">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ← Anterior
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Siguiente →
        </Button>
      </div>
    </nav>
  );
}
