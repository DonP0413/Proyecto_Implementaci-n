/** Objetivo: gestión de clientes (búsqueda, alta, edición) y acceso a su historial de reparaciones. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientsApi } from '../../api/endpoints';
import type { Client } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { getErrorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import { ClientForm } from './ClientForm';

export function ClientsPage() {
  const canEdit = useAuthStore((s) => s.hasRole('RECEPCIONISTA'));
  const [term, setTerm] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Client | null | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(term.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clients', 'list', q, page],
    queryFn: () => clientsApi.search(q, page, 20),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clientes</h1>
        {canEdit && <Button onClick={() => setEditing(null)}>+ Nuevo cliente</Button>}
      </div>
      <Card>
        <input className="search-input" aria-label="Buscar clientes" placeholder="Buscar por nombre, cédula, correo o teléfono" value={term} onChange={(e) => setTerm(e.target.value)} />
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <Alert kind="error">{getErrorMessage(error)}</Alert>
        ) : !data?.items.length ? (
          <EmptyState title="Sin clientes" />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Ingreso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.fullName}</td>
                    <td>{c.documentId ?? '—'}</td>
                    <td>{c.email}</td>
                    <td>{c.phone ?? '—'}</td>
                    <td>{formatDate(c.registeredAt)}</td>
                    <td className="row-actions">
                      <Link to={`/work-orders?clientId=${c.id}`} className="btn btn-ghost btn-sm">
                        Historial
                      </Link>
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                          Editar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
          </>
        )}
      </Card>
      <Modal open={editing !== undefined} title={editing ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setEditing(undefined)}>
        {editing !== undefined && <ClientForm client={editing} onDone={() => setEditing(undefined)} />}
      </Modal>
    </div>
  );
}
