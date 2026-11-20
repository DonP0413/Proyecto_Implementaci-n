/**
 * Objetivo: prueba de integración end-to-end contra una base SQLite temporal
 * (ver setup-e2e.ts: migraciones y administrador se crean al iniciar la app).
 * Recorre el flujo completo: login -> ingreso -> revisión -> cotización ->
 * reparación -> listo -> entrega, descargando los 3 PDF para el cliente.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';

const ADMIN = { username: process.env.ADMIN_USER!, password: process.env.ADMIN_PASSWORD! };

const binaryParser = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  (res as unknown as NodeJS.ReadableStream).on('data', (chunk: Buffer) => chunks.push(chunk));
  (res as unknown as NodeJS.ReadableStream).on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('Flujo de orden de trabajo (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let token: string;

  beforeAll(async () => {
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

  it('crea usuarios con nombre de usuario (sin correo) y valida el formato', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(http)
      .post('/api/v1/users')
      .set(auth)
      .send({ fullName: 'Ana Torres', username: 'Ana.Torres', password: 'Clave2026', role: 'RECEPCIONISTA' })
      .expect(201);
    // Se guarda en minúsculas y se inicia sesión con el usuario, sin importar mayúsculas.
    await request(http)
      .post('/api/v1/auth/login')
      .send({ username: 'ANA.torres', password: 'Clave2026' })
      .expect(200);
    await request(http)
      .post('/api/v1/users')
      .set(auth)
      .send({ fullName: 'Con Espacio', username: 'con espacio', password: 'Clave2026', role: 'TECNICO' })
      .expect(400);
    const wrong = await request(http)
      .post('/api/v1/auth/login')
      .send({ username: 'ana.torres', password: 'Otra2026' })
      .expect(401);
    expect(wrong.body.message).toBe('Usuario o contraseña incorrectos');
    const users = await request(http).get('/api/v1/users').set(auth).expect(200);
    expect(users.body.map((u: { username: string }) => u.username)).toEqual(
      expect.arrayContaining(['ana.torres', 'e2e-admin']),
    );
  });

  it('recorre el ciclo completo de una reparación', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const types = await request(http).get('/api/v1/equipment-types').set(auth).expect(200);
    const laptop = types.body.find((t: { code: string }) => t.code === 'LAPTOP');

    // Validación de tipos: cédula con letras y teléfono con letras se rechazan (400).
    const invalid = await request(http)
      .post('/api/v1/clients')
      .set(auth)
      .send({
        fullName: 'Cliente Inválido',
        documentId: '17181234AB',
        email: 'x@example.com',
        phone: '099ABC4567',
      })
      .expect(400);
    expect(JSON.stringify(invalid.body)).toContain('Cédula (10 dígitos) o RUC (13 dígitos)');

    const created = await request(http)
      .post('/api/v1/work-orders')
      .set(auth)
      .field(
        'data',
        JSON.stringify({
          client: {
            fullName: 'Cliente E2E',
            email: 'cliente.e2e@example.com',
            documentId: String(Date.now()).slice(-10),
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

    const pdf = async (kind: 'receipt' | 'quotation-pdf' | 'ready-pdf') => {
      const res = await request(http)
        .get(`/api/v1/work-orders/${id}/${kind}`)
        .set(auth)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      return res;
    };
    await pdf('receipt');
    // Sin cotización ni estado "Listo para retirar" los otros PDF no están disponibles
    await request(http).get(`/api/v1/work-orders/${id}/quotation-pdf`).set(auth).expect(422);
    await request(http).get(`/api/v1/work-orders/${id}/ready-pdf`).set(auth).expect(422);

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
    await pdf('quotation-pdf');
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
    const ready = await pdf('ready-pdf');
    expect(ready.headers['content-disposition']).toContain('listo-para-entregar');

    const delivered = await request(http)
      .post(`/api/v1/work-orders/${id}/delivery`)
      .set(auth)
      .field(
        'data',
        JSON.stringify({
          workSummary: 'Se reemplazó el puerto de carga',
          amountCharged: 35.5,
          returnCondition: 'Equipo funcional',
          receivedByName: 'Cliente Prueba',
          returnedAccessoryIds: [],
        }),
      )
      .expect(200);
    expect(delivered.body.status).toBe('ENTREGADO');
    expect(delivered.body.internal.technicalLogs).toHaveLength(1);

    const deliveryPdf = await pdf('ready-pdf');
    expect(deliveryPdf.headers['content-disposition']).toContain('comprobante-entrega');

    const search = await request(http)
      .get(`/api/v1/work-orders?q=${created.body.code}`)
      .set(auth)
      .expect(200);
    expect(search.body.items[0].id).toBe(id);

    // Búsqueda sin distinguir mayúsculas y filtro por fecha de ingreso (hoy, zona horaria del negocio)
    const byClient = await request(http).get('/api/v1/work-orders?client=cliente e2e').set(auth).expect(200);
    expect(byClient.body.items.map((i: { id: string }) => i.id)).toContain(id);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
    const byDate = await request(http)
      .get(`/api/v1/work-orders?dateFrom=${today}&dateTo=${today}`)
      .set(auth)
      .expect(200);
    expect(byDate.body.items.map((i: { id: string }) => i.id)).toContain(id);
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const empty = await request(http).get(`/api/v1/work-orders?dateFrom=${tomorrow}`).set(auth).expect(200);
    expect(empty.body.items).toHaveLength(0);

    const stats = await request(http).get('/api/v1/work-orders/stats').set(auth).expect(200);
    expect(JSON.stringify(stats.body)).toContain('ENTREGADO');
  });
});
