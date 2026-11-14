import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthUser } from '../../../common/auth/auth-user.interface';
import { BusinessRuleError, InvalidInputError } from '../../../common/errors/domain.errors';
import { ClientsService } from '../../clients/clients.service';
import { EquipmentService } from '../../equipment/equipment.service';
import { MetricsService } from '../../metrics/metrics.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { NotificationTrigger, NotificationType } from '../../notifications/domain/notification.enums';
import { UserRole } from '../../users/domain/user-role.enum';
import { UsersService } from '../../users/users.service';
import { WorkOrderStatus } from '../domain/work-order-status';
import { PhysicalCondition, PowerStatus } from '../domain/work-order.enums';
import { WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { AttachmentsService } from './attachments.service';
import { CreateWorkOrderDto } from './dto/work-order-input.dto';
import { NotificationPayloadFactory } from './notification-payload.factory';
import { ReceiptService } from './receipt.service';
import { WorkOrderCommandService } from './work-order-command.service';

describe('WorkOrderCommandService', () => {
  const actor: AuthUser = { id: 'u1', email: 'a@a.com', fullName: 'Ana', role: UserRole.RECEPCIONISTA };
  const manager = {} as EntityManager;
  const dataSource = { transaction: jest.fn((cb: (m: EntityManager) => unknown) => cb(manager)) };

  const workOrders = {
    nextSequence: jest.fn().mockResolvedValue(7),
    saveWorkOrder: jest.fn((data) => Promise.resolve({ id: 'wo1', ...data })),
    saveReception: jest.fn(),
    updateReception: jest.fn(),
    deleteAttachmentsByCategory: jest.fn(),
    findAttachmentsByCategory: jest.fn().mockResolvedValue([]),
    saveAccessories: jest.fn(),
    addStatusHistory: jest.fn(),
    findForClientDocuments: jest.fn().mockResolvedValue({ id: 'wo1', code: 'PT-2026-000007' }),
    lockById: jest.fn(),
    updateWorkOrder: jest.fn(),
    saveQuotation: jest.fn(),
  };
  const clients = {
    resolveForWorkOrder: jest.fn().mockResolvedValue({ id: 'c1', email: 'cliente@example.com' }),
    updateForIntake: jest.fn().mockResolvedValue({ id: 'c1', email: 'corregido@example.com' }),
  };
  const equipment = {
    resolveForWorkOrder: jest
      .fn()
      .mockResolvedValue({ equipment: { id: 'e1', technicalSpecs: { ram: '8 GB' } } }),
    updateForIntake: jest.fn().mockResolvedValue({
      equipment: { id: 'e1', serialNumber: 'SN-CORREGIDO' },
      type: { id: 1, name: 'Laptop' },
      specs: { ram: '8 GB' },
    }),
  };
  const attachments = {
    validateAll: jest.fn().mockReturnValue([]),
    persist: jest.fn().mockResolvedValue([]),
    cleanup: jest.fn(),
  };
  const receipts = { generate: jest.fn().mockResolvedValue(Buffer.from('%PDF-')) };
  const payloads = {
    build: jest.fn().mockReturnValue({
      subject: 'Recibimos',
      recipientEmail: 'cliente@example.com',
      payload: { data: {}, attachments: [] },
    }),
  };
  const notifications = {
    enqueue: jest.fn(),
    signalEnqueued: jest.fn(),
    syncRecipientForClient: jest.fn(),
  };
  const config = { get: jest.fn((key: string) => (key === 'workOrders.codePrefix' ? 'PT' : undefined)) };

  const service = new WorkOrderCommandService(
    dataSource as unknown as DataSource,
    workOrders as unknown as WorkOrdersRepository,
    clients as unknown as ClientsService,
    equipment as unknown as EquipmentService,
    {} as UsersService,
    attachments as unknown as AttachmentsService,
    receipts as unknown as ReceiptService,
    payloads as unknown as NotificationPayloadFactory,
    notifications as unknown as NotificationsService,
    new MetricsService(),
    config as unknown as ConfigService,
  );

  const dto = Object.assign(new CreateWorkOrderDto(), {
    client: { fullName: 'María', documentId: '1718123456', email: 'cliente@example.com' },
    equipment: { equipmentTypeId: 1, brand: 'HP', model: 'Pavilion', serialNumber: 'SN1' },
    reportedIssue: 'No enciende',
    reception: { powerStatus: PowerStatus.NO, physicalCondition: PhysicalCondition.BUENO },
    accessories: [{ name: 'Cargador', quantity: 1 }],
  });

  beforeEach(() => jest.clearAllMocks());

  it('registra el ingreso, genera el código, el comprobante y encola el correo automático', async () => {
    const result = await service.create(dto, [], actor);

    expect(result.code).toMatch(/^PT-\d{4}-000007$/);
    expect(result.status).toBe(WorkOrderStatus.INGRESADO);
    expect(workOrders.saveReception).toHaveBeenCalled();
    expect(workOrders.addStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: WorkOrderStatus.INGRESADO }),
      manager,
    );
    expect(receipts.generate).toHaveBeenCalled();
    expect(notifications.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.RECEPTION, trigger: NotificationTrigger.AUTOMATIC }),
      manager,
    );
    expect(notifications.signalEnqueued).toHaveBeenCalledTimes(1);
  });

  it('usa la fecha de ingreso indicada (orden, código y cliente nuevo)', async () => {
    const receivedAt = '2025-12-31T15:00:00.000Z';
    const result = await service.create({ ...dto, receivedAt } as CreateWorkOrderDto, [], actor);

    expect(workOrders.saveWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({ receivedAt: new Date(receivedAt) }),
      manager,
    );
    expect(result.code).toBe('PT-2025-000007');
    expect(clients.resolveForWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({ client: expect.objectContaining({ registeredAt: '2025-12-31' }) }),
      manager,
    );
  });

  it('sin fecha de ingreso usa el momento del registro', async () => {
    const before = Date.now();
    await service.create(dto, [], actor);
    const saved = workOrders.saveWorkOrder.mock.calls[0][0] as { receivedAt: Date };
    expect(saved.receivedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rechaza una fecha de ingreso futura', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await expect(
      service.create({ ...dto, receivedAt: future } as CreateWorkOrderDto, [], actor),
    ).rejects.toBeInstanceOf(InvalidInputError);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('exige cliente', async () => {
    await expect(
      service.create({ ...dto, client: undefined, clientId: undefined } as CreateWorkOrderDto, [], actor),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  it('limpia archivos huérfanos si la transacción falla', async () => {
    workOrders.saveReception.mockRejectedValueOnce(new Error('db down'));
    await expect(service.create(dto, [], actor)).rejects.toThrow('db down');
    expect(attachments.cleanup).toHaveBeenCalled();
    expect(notifications.signalEnqueued).not.toHaveBeenCalled();
  });

  it('no permite marcar ENTREGADO con el cambio de estado genérico desde LISTO_PARA_RETIRAR', async () => {
    workOrders.lockById.mockResolvedValue({ id: 'wo1', status: WorkOrderStatus.LISTO_PARA_RETIRAR });
    await expect(
      service.changeStatus('wo1', { status: WorkOrderStatus.ENTREGADO }, actor),
    ).rejects.toThrow('registre la entrega');
  });

  it('no permite pasar directo de INGRESADO a ENTREGADO y muestra el siguiente estado permitido', async () => {
    workOrders.lockById.mockResolvedValue({ id: 'wo1', status: WorkOrderStatus.INGRESADO });
    await expect(
      service.changeStatus('wo1', { status: WorkOrderStatus.ENTREGADO }, actor),
    ).rejects.toThrow('Siguiente estado permitido: "En revisión"');
  });

  it('valida la transición con la máquina de estados', async () => {
    workOrders.lockById.mockResolvedValue({ id: 'wo1', status: WorkOrderStatus.INGRESADO });
    await expect(
      service.changeStatus('wo1', { status: WorkOrderStatus.LISTO_PARA_RETIRAR }, actor),
    ).rejects.toThrow('No se puede pasar');
    await service.changeStatus('wo1', { status: WorkOrderStatus.EN_REVISION }, actor);
    expect(workOrders.updateWorkOrder).toHaveBeenCalledWith(
      'wo1',
      { status: WorkOrderStatus.EN_REVISION },
      manager,
    );
  });

  it('la cotización pasa la orden a COTIZACION_GENERADA', async () => {
    workOrders.lockById.mockResolvedValue({ id: 'wo1', status: WorkOrderStatus.EN_REVISION });
    await service.createQuotation('wo1', { amount: 50, description: 'Cambio de pantalla' }, actor);
    expect(workOrders.saveQuotation).toHaveBeenCalledWith(expect.objectContaining({ amount: 50 }), manager);
    expect(workOrders.updateWorkOrder).toHaveBeenCalledWith(
      'wo1',
      { status: WorkOrderStatus.COTIZACION_GENERADA },
      manager,
    );
  });

  it('no permite cotizar una orden recién ingresada', async () => {
    workOrders.lockById.mockResolvedValue({ id: 'wo1', status: WorkOrderStatus.INGRESADO });
    await expect(
      service.createQuotation('wo1', { amount: 10, description: 'x' }, actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('permite corregir datos del ingreso mientras está en estado INGRESADO y registra quién lo hizo', async () => {
    workOrders.lockById.mockResolvedValue({
      id: 'wo1',
      code: 'PT-2026-000007',
      status: WorkOrderStatus.INGRESADO,
    });
    workOrders.findForClientDocuments.mockResolvedValue({
      id: 'wo1',
      code: 'PT-2026-000007',
      status: WorkOrderStatus.INGRESADO,
      reportedIssue: 'No enciende',
      specsSnapshot: { ram: '8 GB' },
      estimatedDeliveryDate: null,
      client: {
        id: 'c1',
        fullName: 'María',
        documentId: '1718123456',
        email: 'mal@example.com',
        phone: null,
        address: null,
      },
      equipment: {
        id: 'e1',
        equipmentTypeId: 1,
        equipmentType: { id: 1, name: 'Laptop' },
        brand: 'HP',
        model: 'Pavilion',
        serialNumber: 'SN-MAL',
      },
      receptionCondition: {
        powerStatus: PowerStatus.NO,
        physicalCondition: PhysicalCondition.BUENO,
        visibleDamage: null,
        functionalNotes: null,
      },
    });

    await service.updateIntake(
      'wo1',
      {
        client: { fullName: 'María', documentId: '1718123456', email: 'corregido@example.com' },
        equipment: {
          equipmentTypeId: 1,
          brand: 'HP',
          model: 'Pavilion',
          serialNumber: 'SN-CORREGIDO',
          technicalSpecs: { ram: '8 GB' },
        },
        reportedIssue: 'No enciende',
        reception: { powerStatus: PowerStatus.NO, physicalCondition: PhysicalCondition.BUENO },
      },
      actor,
    );

    expect(clients.updateForIntake).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ email: 'corregido@example.com' }),
      manager,
    );
    expect(equipment.updateForIntake).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ serialNumber: 'SN-CORREGIDO' }),
      manager,
    );
    expect(workOrders.addStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: 'wo1',
        fromStatus: WorkOrderStatus.INGRESADO,
        toStatus: WorkOrderStatus.INGRESADO,
        changedById: actor.id,
        note: expect.stringContaining('Corrección de ingreso:'),
      }),
      manager,
    );
  });

  it('no permite corregir datos del ingreso si la orden ya no está en estado INGRESADO', async () => {
    workOrders.lockById.mockResolvedValue({ id: 'wo1', status: WorkOrderStatus.EN_REVISION });
    await expect(
      service.updateIntake(
        'wo1',
        {
          client: { fullName: 'María', documentId: '1718123456', email: 'corregido@example.com' },
          equipment: { equipmentTypeId: 1, brand: 'HP', model: 'Pavilion', serialNumber: 'SN-CORREGIDO' },
          reportedIssue: 'No enciende',
          reception: { powerStatus: PowerStatus.NO, physicalCondition: PhysicalCondition.BUENO },
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
