/** Objetivo: datos del ingreso: cliente, equipo, características, estado de recepción y accesorios. */
import type { WorkOrderDetail } from '../../../api/types';
import { Card, DataRow } from '../../../components/ui/Feedback';
import { formatDate, formatDateTime } from '../../../lib/format';
import { AttachmentGallery } from '../components/AttachmentGallery';

export function ReceptionSection({ wo }: { wo: WorkOrderDetail }) {
  const { reception, accessories, specs, reportedIssue, attachments } = wo.clientVisible;
  const photos = attachments.filter((a) => a.category === 'RECEPTION_PHOTO');

  return (
    <div className="grid-2">
      <Card title="Cliente">
        <dl className="data-list">
          <DataRow label="Nombre" value={wo.client.fullName} />
          <DataRow label="Documento" value={wo.client.documentId} />
          <DataRow label="Correo" value={wo.client.email} />
          <DataRow label="Teléfono" value={wo.client.phone} />
        </dl>
      </Card>
      <Card title="Equipo">
        <dl className="data-list">
          <DataRow label="Tipo" value={wo.equipment.typeName} />
          <DataRow label="Marca / Modelo" value={`${wo.equipment.brand} ${wo.equipment.model}`} />
          <DataRow label="N.º de serie" value={wo.equipment.serialNumber} />
          {specs.map((spec) => (
            <DataRow key={spec.key} label={spec.label} value={spec.value} />
          ))}
        </dl>
      </Card>
      <Card title="Falla reportada y estado de recepción">
        <p className="pre-wrap">{reportedIssue}</p>
        {reception && (
          <dl className="data-list">
            <DataRow label="¿Enciende?" value={reception.powerStatusLabel} />
            <DataRow label="Estado físico" value={reception.physicalConditionLabel} />
            <DataRow label="Daños visibles" value={reception.visibleDamage} />
            <DataRow label="Observaciones" value={reception.functionalNotes} />
          </dl>
        )}
        <dl className="data-list">
          <DataRow label="Recibido" value={`${formatDateTime(wo.receivedAt)} por ${wo.receivedBy?.fullName ?? '—'}`} />
          <DataRow label="Entrega estimada" value={formatDate(wo.estimatedDeliveryDate)} />
        </dl>
      </Card>
      <Card title={`Accesorios recibidos (${accessories.length})`}>
        {accessories.length === 0 ? (
          <p className="muted">Sin accesorios.</p>
        ) : (
          <ul className="plain-list">
            {accessories.map((a) => (
              <li key={a.id}>
                {a.name} ×{a.quantity} {a.notes && <span className="muted">— {a.notes}</span>}
                {a.returned && <span className="badge badge-teal">Devuelto</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Fotografías de recepción" className="span-2">
        <AttachmentGallery attachments={photos} emptyText="No se registraron fotografías al ingreso." />
      </Card>
    </div>
  );
}
