/** Objetivo: buscador de clientes existentes con debounce (nombre, cédula, correo o teléfono). */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { clientsApi } from '../../../api/endpoints';
import type { Client } from '../../../api/types';

export function ClientPicker({ selected, onSelect, error }: { selected: Client | null; onSelect: (client: Client | null) => void; error?: string }) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ['clients', 'picker', debounced],
    queryFn: () => clientsApi.search(debounced, 1, 8),
    enabled: debounced.length >= 2,
  });

  if (selected) {
    return (
      <div className="selected-client">
        <div>
          <strong>{selected.fullName}</strong>
          <div className="muted">
            {selected.documentId ?? 'Sin documento'} · {selected.email} {selected.phone ? `· ${selected.phone}` : ''}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor="client-search">Buscar cliente</label>
      <input
        id="client-search"
        placeholder="Nombre, cédula, correo o teléfono (mín. 2 caracteres)"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        autoComplete="off"
      />
      {error && <small className="error-text">{error}</small>}
      {isFetching && <small className="muted">Buscando…</small>}
      {data && debounced.length >= 2 && (
        <ul className="picker-results">
          {data.items.length === 0 && <li className="muted">Sin resultados. Registre un cliente nuevo.</li>}
          {data.items.map((client) => (
            <li key={client.id}>
              <button type="button" onClick={() => onSelect(client)}>
                <strong>{client.fullName}</strong>
                <span className="muted"> {client.documentId ?? ''} · {client.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
