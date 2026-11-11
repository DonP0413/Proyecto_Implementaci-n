/**
 * Objetivo: casos de uso de LECTURA (Query side): búsqueda por ID de
 * trabajo, cliente, serie, fecha o estado (requerimiento 9), detalle con
 * separación cliente/interno y estadísticas para el tablero.
 */
import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../common/errors/domain.errors';
import { paginate, Paginated } from '../../../common/pagination/pagination';
import { WORK_ORDER_STATUS_LABELS, WorkOrderStatus } from '../domain/work-order-status';
import { WorkOrdersQueryRepository } from '../infrastructure/work-orders-query.repository';
import { WorkOrderQueryDto } from './dto/work-order-input.dto';
import type { WorkOrderDetailDto, WorkOrderSummaryDto } from './dto/work-order-output.dto';
import { WorkOrderMapper } from './work-order.mapper';

@Injectable()
export class WorkOrderQueryService {
  constructor(private readonly queries: WorkOrdersQueryRepository) {}

  async search(query: WorkOrderQueryDto): Promise<Paginated<WorkOrderSummaryDto>> {
    const [items, total] = await this.queries.search({ ...query, page: query.page, limit: query.limit });
    return paginate(items.map(WorkOrderMapper.summary), total, query.page, query.limit);
  }

  async detail(id: string): Promise<WorkOrderDetailDto> {
    const wo = await this.queries.findDetail(id);
    if (!wo) throw new NotFoundError('Orden de trabajo', id);
    return WorkOrderMapper.detail(wo);
  }

  async findIdByCode(code: string): Promise<{ id: string; code: string }> {
    const wo = await this.queries.findByCode(code);
    if (!wo) throw new NotFoundError('Orden de trabajo', code);
    return { id: wo.id, code: wo.code };
  }

  async stats(): Promise<{
    total: number;
    byStatus: Array<{ status: WorkOrderStatus; label: string; count: number }>;
  }> {
    const counts = await this.queries.countByStatus();
    const byStatus = Object.values(WorkOrderStatus).map((status) => ({
      status,
      label: WORK_ORDER_STATUS_LABELS[status],
      count: counts[status] ?? 0,
    }));
    return { total: byStatus.reduce((sum, s) => sum + s.count, 0), byStatus };
  }
}
