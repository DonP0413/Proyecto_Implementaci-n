/** Objetivo: consulta de trabajos (RF-09) con filtros combinables y paginación. */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { WorkOrderFilters as Filters, WorkOrderStatus } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { Pagination } from '../../../components/ui/Pagination';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { StatusBadge } from '../components/StatusBadge';
import { WorkOrderFilters } from '../components/WorkOrderFilters';
import { useWorkOrders } from '../hooks';

export function WorkOrdersListPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const canCreate = useAuthStore((s) => s.hasRole('RECEPCIONISTA'));
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    limit: 20,
    clientId: params.get('clientId') ?? undefined,
    status: (params.get('status')?.split(',').filter(Boolean) as WorkOrderStatus[] | undefined) ?? undefined,
  });
  const { data, isLoading, isError, error, isFetching } = useWorkOrders(filters);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Órdenes de trabajo</h1>
        {canCreate && (
          <Link to="/work-orders/new" className="btn btn-primary btn-md">
            + Registrar ingreso
          </Link>
        )}
      </div>

      <Card>
        <WorkOrderFilters value={filters} onChange={(f) => setFilters({ ...f, limit: 20, clientId: filters.clientId })} />
        {filters.clientId && (
          <Alert kind="info">
            Mostrando el historial de un cliente.{' '}
            <Button size="sm" variant="ghost" onClick={() => setFilters({ ...filters, clientId: undefined, page: 1 })}>
              Quitar filtro
            </Button>
          </Alert>
        )}
      </Card>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <Alert kind="error">{getErrorMessage(error)}</Alert>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No se encontraron órdenes" description="Ajuste los filtros de búsqueda." />
        ) : (
          <>
            <div className="table-wrapper" aria-busy={isFetching}>
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>ID de trabajo</th>
                    <th>Cliente</th>
                    <th>Equipo</th>
                    <th>N.º de serie</th>
                    <th>Ingreso</th>
                    <th>Técnico</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((wo) => (
                    <tr key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/work-orders/${wo.id}`)}>
                      <td>
                        <Link to={`/work-orders/${wo.id}`} className="code" onClick={(e) => e.stopPropagation()}>
                          {wo.code}
                        </Link>
                      </td>
                      <td>
                        {wo.client.fullName}
                        <div className="muted small">{wo.client.phone ?? wo.client.email}</div>
                      </td>
                      <td>
                        {wo.equipment.typeName}
                        <div className="muted small">
                          {wo.equipment.brand} {wo.equipment.model}
                        </div>
                      </td>
                      <td>{wo.equipment.serialNumber ?? '—'}</td>
                      <td>{formatDateTime(wo.receivedAt)}</td>
                      <td>{wo.assignedTechnician?.fullName ?? <span className="muted">Sin asignar</span>}</td>
                      <td>
                        <StatusBadge status={wo.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </Card>
    </div>
  );
}
