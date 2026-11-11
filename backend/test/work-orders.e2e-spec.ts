/**
 * Objetivo: prueba de integración end-to-end contra PostgreSQL real
 * (servicio `postgres` en GitHub Actions o `docker compose up postgres`).
 * Recorre el flujo completo: login -> ingreso -> revisión -> cotización ->
 * reparación -> listo -> entrega, verificando correos encolados.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import * as path from 'node:path';
import { Client } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { runMigrations } from '../src/infrastructure/database/migration-runner';
import { configureApp } from '../src/main';

const ADMIN = { email: 'e2e-admin@pintotech.test', password: 'E2eClave2026' };

describe('Flujo de orden de trabajo (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let token: string;

  beforeAll(async () => {
    const pg = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    await pg.connect();
    await runMigrations(pg, path.resolve(__dirname, '..', '..', 'database', 'migrations'));
    await pg.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES ('E2E Admin', $1, $2, 'ADMIN')
       ON CONFLICT DO NOTHING`,
      [ADMIN.email, await bcrypt.hash(ADMIN.password, 4)],
    );
    await pg.end();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health/ready responde ok', async () => {
    const res = await request(http).get('/health/ready').expect(200);
    expect(res.body.checks.database.status).toBe('up');
  });

  it('rechaza peticiones sin token', async () => {
    await request(http).get('/api/v1/work-orders').expect(401);
  });

  it('inicia sesión', async () => {
    const res = await request(http).post('/api/v1/auth/login').send(ADMIN).expect(200);
    token = res.body.accessToken;
    expect(token).toBeDefined();
  });

  it('recorre el ciclo completo de una reparación', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const types = await request(http).get('/api/v1/equipment-types').set(auth).expect(200);
    const laptop = types.body.find((t: { code: string }) => t.code === 'LAPTOP');

    const created = await request(http)
      .post('/api/v1/work-orders')
      .set(auth)
      .field(
        'data',
        JSON.stringify({
          client: {
            fullName: 'Cliente E2E',
            email: 'cliente.e2e@example.com',
            documentId: `E2E${Date.now()}`.slice(0, 20),
          },
          equipment: {
            equipmentTypeId: laptop.id,
            brand: 'Lenovo',
            model: 'ThinkPad T14',
            serialNumber: `SN-${Date.now()}`,
            technicalSpecs: { ram: '16 GB' },
          },
          reportedIssue: 'No carga la batería',
          reception: { powerStatus: 'SI', physicalCondition: 'BUENO', visibleDamage: 'Ninguno' },
          accessories: [{ name: 'Cargador', quantity: 1 }],
        }),
      )
      .expect(201);
    const id = created.body.id as string;
    expect(created.body.code).toMatch(/^PT-\d{4}-\d{6}$/);

    const receipt = await request(http).get(`/api/v1/work-orders/${id}/receipt`).set(auth).expect(200);
    expect(receipt.headers['content-type']).toContain('application/pdf');

    await request(http)
      .patch(`/api/v1/work-orders/${id}/status`)
      .set(auth)
      .send({ status: 'EN_REVISION' })
      .expect(200);
    await request(http)
      .post(`/api/v1/work-orders/${id}/quotations`)
      .set(auth)
      .send({ amount: 35.5, description: 'Cambio de puerto de carga', estimatedDays: 2 })
      .expect(201);
    await request(http).post(`/api/v1/work-orders/${id}/notifications/quotation`).set(auth).expect(202);
    await request(http)
      .patch(`/api/v1/work-orders/${id}/status`)
      .set(auth)
      .send({ status: 'EN_REPARACION' })
      .expect(200);
    await request(http)
      .post(`/api/v1/work-orders/${id}/technical-logs`)
      .set(auth)
      .field('data', JSON.stringify({ diagnosis: 'Puerto DC dañado', spareParts: 'Puerto DC genérico' }))
      .expect(201);
    await request(http)
      .patch(`/api/v1/work-orders/${id}/status`)
      .set(auth)
      .send({ status: 'LISTO_PARA_RETIRAR' })
      .expect(200);
    await request(http)
      .post(`/api/v1/work-orders/${id}/notifications/ready-for-pickup`)
      .set(auth)
      .expect(202);

    const delivered = await request(http)
      .post(`/api/v1/work-orders/${id}/delivery`)
      .set(auth)
      .field(
        'data',
        JSON.stringify({
          workSummary: 'Se reemplazó el puerto de carga',
          amountCharged: 35.5,
          returnCondition: 'Equipo funcional',
          receivedByName: 'Cliente E2E',
          returnedAccessoryIds: [],
        }),
      )
      .expect(200);
    expect(delivered.body.status).toBe('ENTREGADO');
    expect(delivered.body.internal.technicalLogs).toHaveLength(1);

    const notifications = await request(http)
      .get(`/api/v1/work-orders/${id}/notifications`)
      .set(auth)
      .expect(200);
    const types2 = notifications.body.map((n: { type: string }) => n.type).sort();
    expect(types2).toEqual(['DELIVERY', 'QUOTATION', 'READY_FOR_PICKUP', 'RECEPTION']);

    const search = await request(http)
      .get(`/api/v1/work-orders?q=${created.body.code}`)
      .set(auth)
      .expect(200);
    expect(search.body.items[0].id).toBe(id);
  });

  it('no filtra el registro técnico en las notificaciones al cliente', async () => {
    const ds = app.get(DataSource);
    const rows: Array<{ payload: unknown }> = await ds.query('SELECT payload FROM notifications');
    expect(JSON.stringify(rows)).not.toContain('Puerto DC dañado');
  });
});
