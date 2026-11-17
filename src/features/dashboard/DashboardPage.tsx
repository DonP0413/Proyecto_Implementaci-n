/** Objetivo: tablero con conteo por estado, búsqueda rápida por ID de trabajo e identidad PINTO TECH. */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { workOrdersApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Alert, Card, Spinner } from '../../components/ui/Feedback';
import { getErrorMessage } from '../../lib/errors';
import { STATUS_TONES } from '../work-orders/constants';
import { useWorkOrderStats } from '../work-orders/hooks';

const SPECIALTIES = [
  'Laptops',
  'Impresoras y Multifunción',
  'Televisores',
  'Electrónicos en General',
];

const SERVICE_PILLARS = [
  { icon: '✓', label: 'Servicio Confiable' },
  { icon: '★', label: 'Calidad y Garantía' },
  { icon: '⚡', label: 'Diagnóstico Rápido' },
  { icon: '⚙', label: 'Servicio Técnico Profesional' },
];

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

      <section className="brand-hero" aria-label="PINTO TECH Servicio Técnico">
        <div className="brand-hero-copy">
          <h2 className="brand-hero-title">Especialistas en reparaciones electrónicas</h2>
          <p className="brand-hero-sub">
            Diagnóstico preciso, atención personalizada y soporte técnico para prolongar la vida útil de cada equipo.
          </p>
        </div>
        <div className="brand-hero-tags">
          {SPECIALTIES.map((tag) => (
            <span key={tag} className="brand-hero-tag">
              {tag}
            </span>
          ))}
        </div>
      </section>

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

      <section className="identity-grid" aria-label="Misión y Visión de PINTO TECH">
        <article className="identity-card">
          <h2 className="identity-title">Misión</h2>
          <p className="identity-text">
            Ofrecer soluciones integrales y confiables en la reparación eléctrica y electrónica de computadoras,
            televisores y más. Garantizando un servicio técnico de excelencia que prolongue la vida útil de los
            dispositivos tecnológicos de nuestros clientes, mediante un diagnóstico preciso y atención personalizada.
          </p>
        </article>
        <article className="identity-card identity-card-dark">
          <h2 className="identity-title">Visión</h2>
          <p className="identity-text">
            Consolidarse como el centro de soporte técnico y de reparación especializada líder en el sector, reconocido
            por su innovación tecnológica, rapidez de respuesta y honestidad, siendo la primera opción de los hogares y
            profesionales que buscan proteger y optimizar su inversión en tecnología.
          </p>
        </article>
      </section>

      <section className="pillars-bar" aria-label="Garantías de servicio">
        {SERVICE_PILLARS.map((item) => (
          <div key={item.label} className="pillar-item">
            <span className="pillar-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
