/**
 * Objetivo: registro INTERNO del técnico (RF-07). Información exclusiva del
 * personal: nunca se incluye en comprobantes. La UI lo marca
 * visualmente para evitar confusiones.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { WorkOrderDetail } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert, Card } from '../../../components/ui/Feedback';
import { Textarea } from '../../../components/ui/FormField';
import { getErrorMessage } from '../../../lib/errors';
import { emptyToUndefined, formatDateTime } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { AttachmentGallery } from '../components/AttachmentGallery';
import { FilePicker } from '../components/FilePicker';
import { useAddTechnicalLog } from '../hooks';
import { technicalLogSchema, type TechnicalLogFormValues } from '../schemas';

const FIELDS: Array<{ key: keyof TechnicalLogFormValues; label: string }> = [
  { key: 'observations', label: 'Observaciones' },
  { key: 'diagnosis', label: 'Diagnósticos' },
  { key: 'configurations', label: 'Configuraciones' },
  { key: 'spareParts', label: 'Repuestos' },
  { key: 'procedures', label: 'Novedades técnicas' },
];

export function TechnicalLogSection({ wo }: { wo: WorkOrderDetail }) {
  const canAddLog = useAuthStore((s) => s.hasRole('TECNICO', 'RECEPCIONISTA'));
  const [documents, setDocuments] = useState<File[]>([]);
  const addLog = useAddTechnicalLog(wo.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TechnicalLogFormValues>({ resolver: zodResolver(technicalLogSchema) });

  const onSubmit = async (values: TechnicalLogFormValues) => {
    try {
      await addLog.mutateAsync({ data: emptyToUndefined(values), documents });
      toast.success('Registro técnico guardado');
      reset();
      setDocuments([]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="internal-zone">
      <Alert kind="warning">
        <strong>Información interna.</strong> Este registro no es visible para el cliente y no se incluye en correos ni comprobantes.
      </Alert>
      <div className="grid-2">
        {canAddLog && (
          <Card title="Nuevo registro técnico">
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {FIELDS.map((f, i) => (
                <Textarea
                  key={f.key}
                  label={f.label}
                  rows={3}
                  error={i === 0 ? errors.observations?.message || errors.diagnosis?.message : errors[f.key]?.message}
                  {...register(f.key)}
                />
              ))}
              <FilePicker
                label="Documentos de respaldo (opcional)"
                files={documents}
                onChange={setDocuments}
                accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.txt"
                maxFiles={6}
                hint="Opcional · PDF, imágenes, Word, Excel o texto. Máx. 6 archivos de 8 MB."
              />
              <Button type="submit" loading={addLog.isPending}>
                Guardar registro
              </Button>
            </form>
          </Card>
        )}
        <Card title={`Bitácora técnica (${wo.internal.technicalLogs.length})`} className={canAddLog ? '' : 'span-2'}>
          {wo.internal.technicalLogs.length === 0 ? (
            <p className="muted">Sin registros técnicos.</p>
          ) : (
            <ul className="log-list">
              {wo.internal.technicalLogs.map((log) => (
                <li key={log.id}>
                  <div className="log-head">
                    <strong>{log.author?.fullName ?? '—'}</strong>
                    <small className="muted">{formatDateTime(log.createdAt)}</small>
                  </div>
                  {FIELDS.map((f) =>
                    log[f.key] ? (
                      <div key={f.key} className="log-field">
                        <span className="log-label">{f.label}</span>
                        <p className="pre-wrap">{log[f.key]}</p>
                      </div>
                    ) : null,
                  )}
                  {log.attachments.length > 0 && <AttachmentGallery attachments={log.attachments} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
