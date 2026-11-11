/** Objetivo: ficha completa de la orden organizada en pestañas por etapa del proceso. */
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { openProtectedFile } from '../../../api/endpoints';
import { Button } from '../../../components/ui/Button';
import { Alert, Spinner } from '../../../components/ui/Feedback';
import { Tabs } from '../../../components/ui/Tabs';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { toast } from '../../../stores/toastStore';
import { StatusBadge } from '../components/StatusBadge';
import { StatusProgress } from '../components/StatusProgress';
import { useWorkOrder } from '../hooks';
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
  const { data: wo, isLoading, isError, error } = useWorkOrder(id);

  if (isLoading) return <Spinner />;
  if (isError || !wo) return <Alert kind="error">{getErrorMessage(error)}</Alert>;

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
          confirmación se envió automáticamente (ver pestaña Correos).
        </Alert>
      )}
      <StatusProgress status={wo.status} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

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
