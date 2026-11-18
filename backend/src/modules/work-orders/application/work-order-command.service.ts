/**
 * Objetivo: casos de uso de ESCRITURA (Command side) del agregado WorkOrder.
 *   - create            : registro de ingreso + estado de recepción + fotos +
 *                         comprobante PDF de ingreso (RF 1-3).
 *   - changeStatus      : seguimiento con máquina de estados (RF 5).
 *   - assignTechnician  : asignación de responsable.
 *   - createQuotation   : registra cotización y pasa a COTIZACION_GENERADA (RF 6).
 *   - registerDelivery  : registro de entrega (RF 7).
 * Cada caso de uso es UNA transacción: si algo falla, no se guarda nada.
 * Al cliente se le entregan documentos PDF (ver ReceiptService), no correos.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthUser } from '../../../common/auth/auth-user.interface';
import {
  BusinessRuleError,
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '../../../common/errors/domain.errors';
import { CLOCK_SKEW_MS, toLocalDate } from '../../../common/time/local-date';
import { ClientsService } from '../../clients/clients.service';
import { EquipmentService } from '../../equipment/equipment.service';
import { MetricsService } from '../../metrics/metrics.service';
import { UserRole } from '../../users/domain/user-role.enum';
import { UsersService } from '../../users/users.service';
import { WorkOrderCodeFactory } from '../domain/work-order-code';
import {
  DEDICATED_TRANSITION_TARGETS,
  WORK_ORDER_STATUS_LABELS,
  WorkOrderStateMachine,
  WorkOrderStatus,
} from '../domain/work-order-status';
import {
  AttachmentCategory,
  PHYSICAL_CONDITION_LABELS,
  POWER_STATUS_LABELS,
} from '../domain/work-order.enums';
import { WorkOrderEntity } from '../infrastructure/entities';
import { WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { AttachmentsService } from './attachments.service';
import {
  AssignTechnicianDto,
  ChangeStatusDto,
  CreateQuotationDto,
  CreateWorkOrderDto,
  RegisterDeliveryDto,
  UpdateWorkOrderIntakeDto,
} from './dto/work-order-input.dto';
import type { WorkOrderCreatedDto } from './dto/work-order-output.dto';
import type { UploadedFileLike } from './file-upload.policy';
import { formatMoney } from './formatters';
import { ReceiptService } from './receipt.service';

@Injectable()
export class WorkOrderCommandService {
  private readonly logger = new Logger(WorkOrderCommandService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly workOrders: WorkOrdersRepository,
    private readonly clients: ClientsService,
    private readonly equipment: EquipmentService,
    private readonly users: UsersService,
    private readonly attachments: AttachmentsService,
    private readonly receipts: ReceiptService,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  async create(
    dto: CreateWorkOrderDto,
    photos: UploadedFileLike[] | undefined,
    actor: AuthUser,
  ): Promise<WorkOrderCreatedDto> {
    if (!dto.clientId && !dto.client) {
      throw new InvalidInputError('Debe seleccionar un cliente o registrar sus datos', 'CLIENT_REQUIRED');
    }
    const receivedAt = this.resolveReceivedAt(dto.receivedAt);
    const validPhotos = this.attachments.validateAll(photos, AttachmentCategory.RECEPTION_PHOTO);
    if (dto.assignedTechnicianId) await this.assertTechnician(dto.assignedTechnicianId);

    const tracker: string[] = [];
    try {
      const workOrder = await this.dataSource.transaction(async (manager) => {
        const timeZone = this.config.get<string>('workOrders.timezone');
        // Cliente nuevo sin fecha propia: ingresa el mismo día que su equipo.
        const clientInput = dto.client
          ? { ...dto.client, registeredAt: dto.client.registeredAt ?? toLocalDate(receivedAt, timeZone) }
          : undefined;
        const client = await this.clients.resolveForWorkOrder(
          { clientId: dto.clientId, client: clientInput },
          manager,
        );
        const { equipment } = await this.equipment.resolveForWorkOrder(client.id, dto.equipment, manager);

        const sequence = await this.workOrders.nextSequence(manager);
        const code = WorkOrderCodeFactory.build(
          this.config.get<string>('workOrders.codePrefix') ?? 'PT',
          receivedAt,
          sequence,
          timeZone,
        );

        const wo = await this.workOrders.saveWorkOrder(
          {
            code,
            clientId: client.id,
            equipmentId: equipment.id,
            status: WorkOrderStatus.INGRESADO,
            reportedIssue: dto.reportedIssue,
            specsSnapshot: equipment.technicalSpecs,
            receivedAt,
            receivedById: actor.id,
            assignedTechnicianId: dto.assignedTechnicianId ?? null,
            estimatedDeliveryDate: dto.estimatedDeliveryDate ?? null,
            deliveredAt: null,
          },
          manager,
        );

        await this.workOrders.saveReception(
          {
            workOrderId: wo.id,
            powerStatus: dto.reception.powerStatus,
            physicalCondition: dto.reception.physicalCondition,
            visibleDamage: dto.reception.visibleDamage ?? null,
            functionalNotes: dto.reception.functionalNotes ?? null,
          },
          manager,
        );
        await this.workOrders.saveAccessories(
          (dto.accessories ?? []).map((a) => ({
            workOrderId: wo.id,
            name: a.name,
            quantity: a.quantity ?? 1,
            notes: a.notes ?? null,
          })),
          manager,
        );
        await this.workOrders.addStatusHistory(
          {
            workOrderId: wo.id,
            fromStatus: null,
            toStatus: WorkOrderStatus.INGRESADO,
            note: 'Ingreso del equipo',
            changedById: actor.id,
          },
          manager,
        );

        await this.attachments.persist(
          {
            workOrderId: wo.id,
            category: AttachmentCategory.RECEPTION_PHOTO,
            files: validPhotos,
            uploadedById: actor.id,
          },
          manager,
          tracker,
        );

        const aggregate = await this.workOrders.findForClientDocuments(wo.id, manager);
        const pdf = await this.receipts.generate(aggregate!, validPhotos[0]);
        await this.attachments.persist(
          {
            workOrderId: wo.id,
            category: AttachmentCategory.RECEIPT_PDF,
            uploadedById: actor.id,
            files: [
              {
                originalName: `comprobante-${code}.pdf`,
                mimeType: 'application/pdf',
                extension: 'pdf',
                buffer: pdf,
                size: pdf.length,
              },
            ],
          },
          manager,
          tracker,
        );
        return wo;
      });

      this.metrics.workOrdersCreated.inc();
      this.logger.log(
        { workOrderId: workOrder.id, code: workOrder.code, actor: actor.id },
        'Orden de trabajo registrada',
      );
      return {
        id: workOrder.id,
        code: workOrder.code,
        status: workOrder.status,
        receiptPath: `/work-orders/${workOrder.id}/receipt`,
      };
    } catch (error) {
      await this.attachments.cleanup(tracker);
      throw error;
    }
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actor: AuthUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const wo = await this.lock(id, manager);
      WorkOrderStateMachine.assertTransition(wo.status, dto.status);
      if (DEDICATED_TRANSITION_TARGETS.includes(dto.status)) {
        throw new BusinessRuleError(
          dto.status === WorkOrderStatus.COTIZACION_GENERADA
            ? 'Para pasar a "Cotización generada" registre la cotización'
            : 'Para marcar como "Entregado" registre la entrega',
          'DEDICATED_TRANSITION_REQUIRED',
        );
      }
      await this.transition(wo, dto.status, dto.note ?? null, actor, manager);
    });
    this.metrics.workOrderStatusChanges.inc({ to_status: dto.status });
  }

  async assignTechnician(id: string, dto: AssignTechnicianDto, actor: AuthUser): Promise<void> {
    if (dto.technicianId) await this.assertTechnician(dto.technicianId);
    await this.dataSource.transaction(async (manager) => {
      const wo = await this.lock(id, manager);
      if (wo.status === WorkOrderStatus.ENTREGADO) {
        throw new BusinessRuleError('No se puede reasignar una orden entregada', 'WORK_ORDER_CLOSED');
      }
      await this.workOrders.updateWorkOrder(id, { assignedTechnicianId: dto.technicianId }, manager);
    });
    this.logger.log({ workOrderId: id, technicianId: dto.technicianId, actor: actor.id }, 'Técnico asignado');
  }

  /**
   * Corrección de datos de ingreso mientras el trabajo permanece en estado INGRESADO.
   * Actualiza cliente, equipo, falla y recepción, regenera el comprobante PDF y deja
   * auditoría en status_history indicando quién realizó la corrección, cuándo y qué cambió.
   */
  async updateIntake(id: string, dto: UpdateWorkOrderIntakeDto, actor: AuthUser): Promise<void> {
    const tracker: string[] = [];
    try {
      await this.dataSource.transaction(async (manager) => {
        const wo = await this.lock(id, manager);
        if (wo.status !== WorkOrderStatus.INGRESADO) {
          throw new BusinessRuleError(
            `Sólo se pueden corregir los datos del ingreso mientras la orden está en estado "Ingresado" (estado actual: ${WORK_ORDER_STATUS_LABELS[wo.status]})`,
            'INTAKE_EDIT_NOT_ALLOWED',
            { status: wo.status },
          );
        }

        const before = await this.workOrders.findForClientDocuments(id, manager);
        if (!before) throw new NotFoundError('Orden de trabajo', id);

        const changes: string[] = [];
        const recordDiff = (
          label: string,
          oldVal: string | null | undefined,
          newVal: string | null | undefined,
        ) => {
          const a = (oldVal ?? '').trim();
          const b = (newVal ?? '').trim();
          if (a !== b) {
            const fmt = (v: string) => (v.length > 35 ? `${v.slice(0, 32)}...` : v || 'vacío');
            changes.push(`${label} (${fmt(a)} → ${fmt(b)})`);
          }
        };

        recordDiff('Nombre', before.client.fullName, dto.client.fullName);
        recordDiff('Cédula/RUC', before.client.documentId, dto.client.documentId);
        recordDiff('Correo', before.client.email, dto.client.email);
        recordDiff('Teléfono', before.client.phone, dto.client.phone ?? null);
        recordDiff('Dirección', before.client.address, dto.client.address ?? null);

        await this.clients.updateForIntake(before.client.id, dto.client, manager);

        const oldTypeName = before.equipment.equipmentType?.name ?? String(before.equipment.equipmentTypeId);
        const oldBrand = before.equipment.brand;
        const oldModel = before.equipment.model;
        const oldSerial = before.equipment.serialNumber;
        const { type: newType, specs } = await this.equipment.updateForIntake(
          before.equipment.id,
          dto.equipment,
          manager,
        );

        recordDiff('Tipo de equipo', oldTypeName, newType.name);
        recordDiff('Marca', oldBrand, dto.equipment.brand);
        recordDiff('Modelo', oldModel, dto.equipment.model);
        recordDiff('N.º de serie', oldSerial, dto.equipment.serialNumber);

        const serializeSpecs = (obj: Record<string, string> = {}) =>
          JSON.stringify(
            Object.keys(obj)
              .sort()
              .map((k) => [k, obj[k]]),
          );
        if (serializeSpecs(before.specsSnapshot) !== serializeSpecs(specs)) {
          changes.push('Características técnicas');
        }

        recordDiff('Falla reportada', before.reportedIssue, dto.reportedIssue);
        recordDiff('Entrega estimada', before.estimatedDeliveryDate, dto.estimatedDeliveryDate ?? null);

        const rc = before.receptionCondition;
        recordDiff(
          '¿Enciende?',
          rc ? POWER_STATUS_LABELS[rc.powerStatus] : null,
          POWER_STATUS_LABELS[dto.reception.powerStatus],
        );
        recordDiff(
          'Estado físico',
          rc ? PHYSICAL_CONDITION_LABELS[rc.physicalCondition] : null,
          PHYSICAL_CONDITION_LABELS[dto.reception.physicalCondition],
        );
        recordDiff('Daños visibles', rc?.visibleDamage ?? null, dto.reception.visibleDamage ?? null);
        recordDiff(
          'Observaciones funcionales',
          rc?.functionalNotes ?? null,
          dto.reception.functionalNotes ?? null,
        );

        if (changes.length === 0) {
          throw new InvalidInputError(
            'No se detectaron cambios en los datos del ingreso',
            'NO_INTAKE_CHANGES',
          );
        }

        await this.workOrders.updateWorkOrder(
          id,
          {
            reportedIssue: dto.reportedIssue,
            specsSnapshot: specs,
            estimatedDeliveryDate: dto.estimatedDeliveryDate ?? null,
          },
          manager,
        );
        await this.workOrders.updateReception(
          id,
          {
            powerStatus: dto.reception.powerStatus,
            physicalCondition: dto.reception.physicalCondition,
            visibleDamage: dto.reception.visibleDamage ?? null,
            functionalNotes: dto.reception.functionalNotes ?? null,
          },
          manager,
        );

        await this.workOrders.addStatusHistory(
          {
            workOrderId: id,
            fromStatus: WorkOrderStatus.INGRESADO,
            toStatus: WorkOrderStatus.INGRESADO,
            note: `Corrección de ingreso: ${changes.join('; ')}`.slice(0, 500),
            changedById: actor.id,
          },
          manager,
        );

        // Regenerar el comprobante PDF con los datos corregidos
        const aggregate = await this.workOrders.findForClientDocuments(id, manager);
        const pdf = await this.receipts.generate(aggregate!);
        await this.workOrders.deleteAttachmentsByCategory(id, [AttachmentCategory.RECEIPT_PDF], manager);
        await this.attachments.persist(
          {
            workOrderId: id,
            category: AttachmentCategory.RECEIPT_PDF,
            uploadedById: actor.id,
            files: [
              {
                originalName: `comprobante-${wo.code}.pdf`,
                mimeType: 'application/pdf',
                extension: 'pdf',
                buffer: pdf,
                size: pdf.length,
              },
            ],
          },
          manager,
          tracker,
        );
      });

      this.logger.log({ workOrderId: id, actor: actor.id }, 'Datos de ingreso corregidos');
    } catch (error) {
      await this.attachments.cleanup(tracker);
      throw error;
    }
  }

  async createQuotation(id: string, dto: CreateQuotationDto, actor: AuthUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const wo = await this.lock(id, manager);
      if (![WorkOrderStatus.EN_REVISION, WorkOrderStatus.COTIZACION_GENERADA].includes(wo.status)) {
        throw new BusinessRuleError(
          'Sólo se puede cotizar un equipo "En revisión" o re-cotizar uno con "Cotización generada"',
          'QUOTATION_NOT_ALLOWED',
          { status: wo.status },
        );
      }
      await this.workOrders.saveQuotation(
        {
          workOrderId: id,
          amount: dto.amount,
          description: dto.description,
          estimatedDays: dto.estimatedDays ?? null,
          createdById: actor.id,
        },
        manager,
      );
      const note = `Cotización ${formatMoney(dto.amount)}`;
      if (wo.status === WorkOrderStatus.EN_REVISION) {
        await this.transition(wo, WorkOrderStatus.COTIZACION_GENERADA, note, actor, manager);
      } else {
        await this.workOrders.addStatusHistory(
          {
            workOrderId: id,
            fromStatus: wo.status,
            toStatus: wo.status,
            note: `Re-cotización: ${note}`,
            changedById: actor.id,
          },
          manager,
        );
      }
    });
    this.metrics.workOrderStatusChanges.inc({ to_status: WorkOrderStatus.COTIZACION_GENERADA });
  }

  async registerDelivery(
    id: string,
    dto: RegisterDeliveryDto,
    photo: UploadedFileLike | undefined,
    actor: AuthUser,
  ): Promise<void> {
    const validPhotos = this.attachments.validateAll(photo ? [photo] : [], AttachmentCategory.DELIVERY_PHOTO);
    const tracker: string[] = [];
    try {
      await this.dataSource.transaction(async (manager) => {
        const wo = await this.lock(id, manager);
        if (wo.status !== WorkOrderStatus.LISTO_PARA_RETIRAR) {
          const allowed = WorkOrderStateMachine.allowedTransitions(wo.status);
          const allowedLabels = allowed.map((s) => `"${WORK_ORDER_STATUS_LABELS[s]}"`).join(', ');
          const suffix = allowedLabels ? ` Siguiente estado permitido: ${allowedLabels}.` : '';
          throw new BusinessRuleError(
            `No se puede pasar de "${WORK_ORDER_STATUS_LABELS[wo.status]}" a "Entregado".${suffix}`,
            'DELIVERY_NOT_ALLOWED',
            { from: wo.status, to: WorkOrderStatus.ENTREGADO, allowed },
          );
        }
        const existing = await this.workOrders.findForClientDocuments(id, manager);
        if (existing?.deliveryRecord)
          throw new ConflictError('La entrega ya fue registrada', 'DELIVERY_EXISTS');

        const deliveredAt = new Date();
        await this.workOrders.saveDelivery(
          {
            workOrderId: id,
            workSummary: dto.workSummary,
            amountCharged: dto.amountCharged,
            returnCondition: dto.returnCondition,
            accessoriesNotes: dto.accessoriesNotes ?? null,
            receivedByName: dto.receivedByName,
            receivedByDocument: dto.receivedByDocument ?? null,
            deliveredById: actor.id,
            deliveredAt,
          },
          manager,
        );
        await this.workOrders.markAccessoriesReturned(id, dto.returnedAccessoryIds ?? [], manager);
        await this.transition(
          wo,
          WorkOrderStatus.ENTREGADO,
          `Retirado por ${dto.receivedByName}`,
          actor,
          manager,
          {
            deliveredAt,
          },
        );
        await this.attachments.persist(
          {
            workOrderId: id,
            category: AttachmentCategory.DELIVERY_PHOTO,
            files: validPhotos,
            uploadedById: actor.id,
          },
          manager,
          tracker,
        );
      });
      this.metrics.workOrderStatusChanges.inc({ to_status: WorkOrderStatus.ENTREGADO });
      this.logger.log({ workOrderId: id, actor: actor.id }, 'Entrega registrada');
    } catch (error) {
      await this.attachments.cleanup(tracker);
      throw error;
    }
  }

  // ---------------------------------------------------------------- helpers

  private async lock(id: string, manager: EntityManager): Promise<WorkOrderEntity> {
    const wo = await this.workOrders.lockById(id, manager);
    if (!wo) throw new NotFoundError('Orden de trabajo', id);
    return wo;
  }

  private async transition(
    wo: WorkOrderEntity,
    to: WorkOrderStatus,
    note: string | null,
    actor: AuthUser,
    manager: EntityManager,
    extra: Partial<WorkOrderEntity> = {},
  ): Promise<void> {
    WorkOrderStateMachine.assertTransition(wo.status, to);
    await this.workOrders.updateWorkOrder(wo.id, { status: to, ...extra }, manager);
    await this.workOrders.addStatusHistory(
      { workOrderId: wo.id, fromStatus: wo.status, toStatus: to, note, changedById: actor.id },
      manager,
    );
    this.logger.log({ workOrderId: wo.id, from: wo.status, to, actor: actor.id }, 'Cambio de estado');
  }

  /**
   * Fecha de ingreso indicada por recepción (p. ej. equipo recibido ayer y
   * registrado hoy). Sin valor, es el momento actual. Nunca futura.
   */
  private resolveReceivedAt(value: string | undefined): Date {
    const now = new Date();
    if (!value) return now;
    const receivedAt = new Date(value);
    if (receivedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
      throw new InvalidInputError('La fecha de ingreso no puede ser futura', 'RECEIVED_AT_IN_FUTURE');
    }
    return receivedAt;
  }

  private async assertTechnician(userId: string): Promise<void> {
    const user = await this.users.getEntity(userId);
    if (!user.isActive || ![UserRole.TECNICO, UserRole.ADMIN].includes(user.role)) {
      throw new BusinessRuleError('El usuario asignado no es un técnico activo', 'INVALID_TECHNICIAN');
    }
  }
}
