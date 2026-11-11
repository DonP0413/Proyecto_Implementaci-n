/** Objetivo: insignia de color por estado de la orden. */
import type { WorkOrderStatus } from '../../../api/types';
import { Badge } from '../../../components/ui/Feedback';
import { STATUS_LABELS, STATUS_TONES } from '../constants';

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
