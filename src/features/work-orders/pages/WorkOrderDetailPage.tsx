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
import type { WorkOrderTab } from '../constants';
import { useWorkOrder } from '../hooks';
import { DeliverySection } from '../sections/DeliverySection';
import { QuotationSection } from '../sections/QuotationSection';
import { ReceptionSection } from '../sections/ReceptionSection';
import { TechnicalLogSection } from '../sections/TechnicalLogSection';
import { TrackingSection } from '../sections/TrackingSection';

const TABS: Array<{ id: WorkOrderTab; label: string }> = [
  { id: 'reception', label: 'Recepción' },
  { id: 'tracking', label: 'Seguimiento' },
  { id: 'quotation', label: 'Cotización' },
  { id: 'technical', label: 'Registro técnico' },
  { id: 'delivery', label: 'Entrega' },
];

export function WorkOrderDetailPage() {
  const { id = '' } = useParams();
  const justCreated = (useLocation().state as { justCreated?: boolean } | null)?.justCreated ?? false;
  const [tab, setTab] = useState<WorkOrderTab>('reception');
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
        {/* Único acceso al PDF de ingreso: visible en todas las pestañas. */}
        <PdfButton variant="primary" path={workOrderPdfPaths.reception(wo.id)}>
          PDF de ingreso
        </PdfButton>
      </div>

      {justCreated && (
        <Alert kind="success">
          Ingreso registrado. Con el botón <strong>PDF de ingreso</strong> (arriba a la derecha) imprima el comprobante para que el
          cliente lo firme y entréguele una copia.
        </Alert>
      )}
      <StatusProgress status={wo.status} />
      <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as WorkOrderTab)} />

      <div role="tabpanel">
        {tab === 'reception' && <ReceptionSection wo={wo} />}
        {tab === 'tracking' && <TrackingSection wo={wo} onGoToTab={setTab} />}
        {tab === 'quotation' && <QuotationSection wo={wo} />}
        {tab === 'technical' && <TechnicalLogSection wo={wo} />}
        {tab === 'delivery' && <DeliverySection wo={wo} />}
      </div>
    </div>
  );
}
