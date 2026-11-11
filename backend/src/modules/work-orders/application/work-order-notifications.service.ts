/**
 * Objetivo: casos de uso de NOTIFICACIONES MANUALES (requerimiento 6):
 * botones "Enviar cotización" y "Notificar listo para retirar".
 * Reglas:
 *  - Cotización: sólo en estado COTIZACION_GENERADA y con una cotización registrada.
 *  - Listo para retirar: sólo en estado LISTO_PARA_RETIRAR.
 *  - No se encola un duplicado si ya hay uno del mismo tipo pendiente/en envío
 *    (evita dobles clics); sí se permite reenviar después de enviado.
 */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../../common/auth/auth-user.interface';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../../common/errors/domain.errors';
import { NotificationResponseDto } from '../../notifications/application/notification.dto';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { NotificationTrigger, NotificationType } from '../../notifications/domain/notification.enums';
import { WorkOrderStatus } from '../domain/work-order-status';
import { WorkOrdersQueryRepository } from '../infrastructure/work-orders-query.repository';
import { WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { NotificationPayloadFactory } from './notification-payload.factory';

const REQUIRED_STATUS: Partial<Record<NotificationType, WorkOrderStatus>> = {
  [NotificationType.QUOTATION]: WorkOrderStatus.COTIZACION_GENERADA,
  [NotificationType.READY_FOR_PICKUP]: WorkOrderStatus.LISTO_PARA_RETIRAR,
};

@Injectable()
export class WorkOrderNotificationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly workOrders: WorkOrdersRepository,
    private readonly queries: WorkOrdersQueryRepository,
    private readonly payloads: NotificationPayloadFactory,
    private readonly notifications: NotificationsService,
  ) {}

  sendQuotation(workOrderId: string, actor: AuthUser): Promise<NotificationResponseDto> {
    return this.sendManual(workOrderId, NotificationType.QUOTATION, actor);
  }

  sendReadyForPickup(workOrderId: string, actor: AuthUser): Promise<NotificationResponseDto> {
    return this.sendManual(workOrderId, NotificationType.READY_FOR_PICKUP, actor);
  }

  async list(workOrderId: string): Promise<NotificationResponseDto[]> {
    if (!(await this.queries.exists(workOrderId))) throw new NotFoundError('Orden de trabajo', workOrderId);
    return this.notifications.listByWorkOrder(workOrderId);
  }

  private async sendManual(
    workOrderId: string,
    type: NotificationType,
    actor: AuthUser,
  ): Promise<NotificationResponseDto> {
    const entity = await this.dataSource.transaction(async (manager) => {
      const wo = await this.workOrders.lockById(workOrderId, manager);
      if (!wo) throw new NotFoundError('Orden de trabajo', workOrderId);

      const required = REQUIRED_STATUS[type];
      if (required && wo.status !== required) {
        throw new BusinessRuleError(
          'El estado actual de la orden no permite enviar esta notificación',
          'NOTIFICATION_NOT_ALLOWED',
          {
            status: wo.status,
            required,
          },
        );
      }
      if (await this.notifications.hasActive(workOrderId, type, manager)) {
        throw new ConflictError(
          'Ya hay una notificación de este tipo en proceso de envío',
          'NOTIFICATION_IN_PROGRESS',
        );
      }

      let quotationId: string | undefined;
      if (type === NotificationType.QUOTATION) {
        const quotation = await this.workOrders.findLatestQuotation(workOrderId, manager);
        if (!quotation)
          throw new BusinessRuleError('Registre una cotización antes de enviarla', 'QUOTATION_REQUIRED');
        quotationId = quotation.id;
      }

      const aggregate = await this.workOrders.findForClientDocuments(workOrderId, manager);
      const built = this.payloads.build(type, aggregate!, []);
      const notification = await this.notifications.enqueue(
        { workOrderId, type, trigger: NotificationTrigger.MANUAL, requestedBy: actor.id, ...built },
        manager,
      );
      if (quotationId) await this.workOrders.markQuotationNotified(quotationId, manager);
      return notification;
    });
    this.notifications.signalEnqueued();
    return NotificationResponseDto.from(entity);
  }
}
