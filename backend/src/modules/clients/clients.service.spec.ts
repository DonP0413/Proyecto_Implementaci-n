import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import { InvalidInputError } from '../../common/errors/domain.errors';
import { todayLocalDate } from '../../common/time/local-date';
import type { ClientEntity } from './client.entity';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';

describe('ClientsService — fecha de ingreso', () => {
  const manager = {} as EntityManager;
  const repo = {
    findByDocumentId: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: Partial<ClientEntity>) => ({ ...data })),
    save: jest.fn((entity: Partial<ClientEntity>) =>
      Promise.resolve({
        id: 'c1',
        createdAt: new Date(),
        documentId: null,
        phone: null,
        address: null,
        ...entity,
      }),
    ),
  };
  const config = { get: jest.fn(() => 'America/Guayaquil') };
  const service = new ClientsService(
    repo as unknown as ClientsRepository,
    config as unknown as ConfigService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('guarda la fecha de ingreso indicada', async () => {
    const result = await service.create({
      fullName: 'Ana Pérez',
      documentId: '1718123456',
      email: 'ana@example.com',
      registeredAt: '2025-03-10',
    });
    expect(result.registeredAt).toBe('2025-03-10');
  });

  it('sin fecha de ingreso usa la fecha de hoy en Ecuador', async () => {
    const result = await service.create({
      fullName: 'Ana Pérez',
      documentId: '1718123456',
      email: 'ana@example.com',
    });
    expect(result.registeredAt).toBe(todayLocalDate('America/Guayaquil'));
  });

  it('rechaza una fecha de ingreso futura', async () => {
    await expect(
      service.create({
        fullName: 'Ana Pérez',
        documentId: '1718123456',
        email: 'ana@example.com',
        registeredAt: '2999-01-01',
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('al reutilizar un cliente por documento conserva su fecha de ingreso original', async () => {
    const existing = {
      id: 'c9',
      fullName: 'Ana',
      email: 'old@example.com',
      documentId: '1718123456',
      registeredAt: '2024-01-05',
    };
    repo.findByDocumentId.mockResolvedValueOnce(existing);
    const saved = await service.resolveForWorkOrder(
      {
        client: {
          fullName: 'Ana Pérez',
          email: 'ana@example.com',
          documentId: '1718123456',
          registeredAt: '2026-11-09',
        },
      },
      manager,
    );
    expect(saved.registeredAt).toBe('2024-01-05');
    expect(saved.email).toBe('ana@example.com');
  });
});
