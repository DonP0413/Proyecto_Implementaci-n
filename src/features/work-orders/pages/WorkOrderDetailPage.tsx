/** Objetivo: ficha completa de la orden organizada en pestañas por etapa del proceso. */
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { openProtectedFile } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { Alert, Spinner } from '../../../components/ui/Feedback';
import { Tabs } from '../../../components/ui/Tabs';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { StatusBadge } from '../components/StatusBadge';
import { StatusProgress } from '../components/StatusProgress';
import { useWorkOrder, useWorkOrderNotifications } from '../hooks';
import { DeliverySection } from '../sections/DeliverySection';
import { NotificationsSection } from '../sections/NotificationsSection';
import { QuotationSection } from '../sections/QuotationSection';
import { ReceptionSection } from '../sections/ReceptionSection';
import { TechnicalLogSection } from '../sections/TechnicalLogSection';
import { TrackingSection } from '../sections/TrackingSection';

const TABS = [
  { id: 'reception', label: 'Recepción' },
  { id: 'tracking', label: 'Seguimiento' },
  { id: 'quotation', label: 'Cotización' },
  { id: 'technical', label: 'Registro técnico' },
  { id: 'delivery', label: 'Entrega' },
  { id: 'notifications', label: 'Correos' },
];

export function WorkOrderDetailPage() {
  const { id = '' } = useParams();
  const justCreated = (useLocation().state as { justCreated?: boolean } | null)?.justCreated ?? false;
  const [tab, setTab] = useState('reception');
  const canSeeFailedInbox = useAuthStore((s) => s.hasRole('RECEPCIONISTA', 'TECNICO'));
  const { data: wo, isLoading, isError, error } = useWorkOrder(id);
  const { data: notifications } = useWorkOrderNotifications(id);

  if (isLoading) return <Spinner />;
  if (isError || !wo) return <Alert kind="error">{getErrorMessage(error)}</Alert>;

  const failedNotifications = (notifications ?? []).filter((n) => n.status === 'FAILED');
  const tabs = TABS.map((t) =>
    t.id === 'notifications' && failedNotifications.length > 0
      ? { ...t, label: `Correos (${failedNotifications.length} fallido${failedNotifications.length > 1 ? 's' : ''})` }
      : t,
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/work-orders" className="muted small">
            ← Órdenes de trabajo
          </Link>
          <h1 className="code-title">
            {wo.code} <StatusBadge status={wo.status} />
          </h1>
          <p className="muted">
            {wo.equipment.typeName} {wo.equipment.brand} {wo.equipment.model} · {wo.client.fullName} · Ingreso {formatDateTime(wo.receivedAt)}
          </p>
        </div>
        <Button variant="secondary" onClick={() => openProtectedFile(`/work-orders/${wo.id}/receipt`).catch((e) => toast.error(getErrorMessage(e)))}>
          Comprobante de ingreso
        </Button>
      </div>

      {justCreated && (
        <Alert kind="success">
          Ingreso registrado. Imprima el <strong>comprobante de ingreso</strong> para que el cliente lo firme; el correo de
          confirmación se procesó automáticamente (ver pestaña Correos).
        </Alert>
      )}
      {failedNotifications.length > 0 && (
        <Alert kind="warning">
          <div className="review-head">
            <div>
              <strong>No se pudo entregar el correo al cliente ({failedNotifications[0].typeLabel}):</strong>{' '}
              {failedNotifications[0].lastError ?? 'Rechazado por el servidor de correo.'} La orden se guardó correctamente y el envío quedó
              registrado en{' '}
              {canSeeFailedInbox ? <Link to="/notifications">Correos fallidos</Link> : <strong>Correos fallidos</strong>} para reintentar.
            </div>
            {tab !== 'notifications' && (
              <Button size="sm" variant="secondary" onClick={() => setTab('notifications')}>
                Ver / Reintentar correo
              </Button>
            )}
          </div>
        </Alert>
      )}
      <StatusProgress status={wo.status} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div role="tabpanel">
        {tab === 'reception' && <ReceptionSection wo={wo} />}
        {tab === 'tracking' && <TrackingSection wo={wo} />}
        {tab === 'quotation' && <QuotationSection wo={wo} />}
        {tab === 'technical' && <TechnicalLogSection wo={wo} />}
        {tab === 'delivery' && <DeliverySection wo={wo} />}
        {tab === 'notifications' && <NotificationsSection workOrderId={wo.id} />}
      </div>
    </div>
  );
}
