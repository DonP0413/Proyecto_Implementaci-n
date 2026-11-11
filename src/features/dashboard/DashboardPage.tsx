/** Objetivo: tablero con conteo por estado y búsqueda rápida por ID de trabajo. */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { workOrdersApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Alert, Card, Spinner } from '../../components/ui/Feedback';
import { getErrorMessage } from '../../lib/errors';
import { STATUS_TONES } from '../work-orders/constants';
import { useWorkOrderStats } from '../work-orders/hooks';

export function DashboardPage() {
  const { data, isLoading, isError, error } = useWorkOrderStats();
  const [code, setCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const navigate = useNavigate();

  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    setLookupError(null);
    try {
      const found = await workOrdersApi.byCode(code.trim());
      navigate(`/work-orders/${found.id}`);
    } catch (e) {
      setLookupError(getErrorMessage(e));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tablero</h1>
      </div>
      <Card title="Buscar por ID de trabajo">
        <form className="inline-form" onSubmit={lookup}>
          <input aria-label="ID de trabajo" placeholder="PT-2026-000123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Button type="submit" disabled={code.trim().length < 3}>
            Abrir
          </Button>
        </form>
        {lookupError && <Alert kind="error">{lookupError}</Alert>}
      </Card>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <Alert kind="error">{getErrorMessage(error)}</Alert>
      ) : (
        <div className="stats-grid">
          {data?.byStatus.map((s) => (
            <Link key={s.status} to={`/work-orders?status=${s.status}`} className={`stat-card stat-${STATUS_TONES[s.status]}`}>
              <span className="stat-value">{s.count}</span>
              <span className="stat-label">{s.label}</span>
            </Link>
          ))}
          <div className="stat-card stat-total">
            <span className="stat-value">{data?.total ?? 0}</span>
            <span className="stat-label">Total histórico</span>
          </div>
        </div>
      )}
    </div>
  );
}
