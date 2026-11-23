/** Objetivo: filtros de búsqueda de órdenes (RF-09: ID, cliente, serie, fecha, estado). */
import { useEffect, useState, type FormEvent } from 'react';
import type { WorkOrderFilters as Filters, WorkOrderStatus } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { STATUS_LABELS, STATUS_ORDER } from '../constants';

const normalizeFilters = (draft: Filters): Filters => ({
  ...draft,
  code: draft.code?.trim() || undefined,
  client: draft.client?.trim() || undefined,
  serial: draft.serial?.trim() || undefined,
  dateFrom: draft.dateFrom || undefined,
  dateTo: draft.dateTo || undefined,
  page: 1,
});

export function WorkOrderFilters({ value, onChange }: { value: Filters; onChange: (filters: Filters) => void }) {
  const [draft, setDraft] = useState<Filters>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const hasInvalidDateRange = !!(draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (hasInvalidDateRange) return;
    onChange(normalizeFilters(draft));
  };

  const updateDate = (field: 'dateFrom' | 'dateTo', nextVal: string) => {
    const next = { ...draft, [field]: nextVal || undefined };
    setDraft(next);
    if (!(next.dateFrom && next.dateTo && next.dateFrom > next.dateTo)) {
      onChange(normalizeFilters(next));
    }
  };

  const toggleStatus = (status: WorkOrderStatus) => {
    const current = draft.status ?? [];
    const nextStatuses = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    const next = { ...draft, status: nextStatuses };
    setDraft(next);
    if (!hasInvalidDateRange) {
      onChange(normalizeFilters(next));
    }
  };

  const reset = () => {
    setDraft({});
    onChange({ page: 1, clientId: undefined, equipmentId: undefined });
  };

  return (
    <form className="filters" onSubmit={submit}>
      <div className="filters-grid">
        <div className="field">
          <label htmlFor="f-code">ID de trabajo</label>
          <input id="f-code" placeholder="PT-2026-000123" value={draft.code ?? ''} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-client">Cliente</label>
          <input id="f-client" placeholder="Nombre, cédula o correo" value={draft.client ?? ''} onChange={(e) => setDraft({ ...draft, client: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-serial">N.º de serie</label>
          <input id="f-serial" placeholder="Ej.: 5CD1234XYZ" value={draft.serial ?? ''} onChange={(e) => setDraft({ ...draft, serial: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-from">Ingreso desde</label>
          <input id="f-from" type="date" value={draft.dateFrom ?? ''} onChange={(e) => updateDate('dateFrom', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-to">Ingreso hasta</label>
          <input id="f-to" type="date" value={draft.dateTo ?? ''} onChange={(e) => updateDate('dateTo', e.target.value)} />
        </div>
      </div>
      {hasInvalidDateRange && <Alert kind="error">La fecha "Ingreso desde" no puede ser mayor que "Ingreso hasta".</Alert>}
      <fieldset className="status-chips">
        <legend>Estado</legend>
        {STATUS_ORDER.map((status) => (
          <label key={status} className={`chip ${draft.status?.includes(status) ? 'chip-active' : ''}`}>
            <input type="checkbox" checked={draft.status?.includes(status) ?? false} onChange={() => toggleStatus(status)} />
            {STATUS_LABELS[status]}
          </label>
        ))}
      </fieldset>
      <div className="filters-actions">
        <Button variant="secondary" onClick={reset}>
          Limpiar
        </Button>
        <Button type="submit">Buscar</Button>
      </div>
    </form>
  );
}
