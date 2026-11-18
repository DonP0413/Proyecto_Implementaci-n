/** Objetivo: ficha completa de la orden organizada en pestañas por etapa del proceso. */
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { workOrderPdfPaths } from '../../../api/endpoints';
import { Alert, Spinner } from '../../../components/ui/Feedback';
import { Tabs } from '../../../components/ui/Tabs';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { PdfButton } from '../components/PdfButton';
import { StatusProgress } from '../components/StatusProgress';
import { useWorkOrder } from '../hooks';
import { DeliverySection } from '../sections/DeliverySection';
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
        <PdfButton path={workOrderPdfPaths.reception(wo.id)}>PDF de ingreso</PdfButton>
      </div>

      {justCreated && (
        <Alert kind="success">
          <div className="review-head">
            <span>
              Ingreso registrado. Imprima el <strong>PDF de ingreso</strong> para que el cliente lo firme y entréguele una copia.
            </span>
            <PdfButton size="sm" variant="primary" path={workOrderPdfPaths.reception(wo.id)}>
              Generar PDF de ingreso
            </PdfButton>
          </div>
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
      </div>
    </div>
  );
}
