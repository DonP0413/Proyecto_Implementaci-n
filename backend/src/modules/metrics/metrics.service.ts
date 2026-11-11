/**
 * Objetivo: registro central de métricas Prometheus (formato OpenMetrics).
 * Métricas técnicas (latencia HTTP, proceso Node) y de negocio (órdenes
 * creadas, correos enviados/fallidos, cola pendiente).
 */
import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: 'pintotech_http_request_duration_seconds',
    help: 'Duración de las peticiones HTTP',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly workOrdersCreated = new Counter({
    name: 'pintotech_work_orders_created_total',
    help: 'Órdenes de trabajo registradas',
    registers: [this.registry],
  });

  readonly workOrderStatusChanges = new Counter({
    name: 'pintotech_work_order_status_changes_total',
    help: 'Cambios de estado de órdenes de trabajo',
    labelNames: ['to_status'] as const,
    registers: [this.registry],
  });

  readonly notificationsProcessed = new Counter({
    name: 'pintotech_notifications_processed_total',
    help: 'Notificaciones procesadas por el worker',
    labelNames: ['type', 'result'] as const,
    registers: [this.registry],
  });

  readonly notificationsPending = new Gauge({
    name: 'pintotech_notifications_pending',
    help: 'Notificaciones pendientes de envío en la cola outbox',
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ app: 'pintotech-backend' });
    collectDefaultMetrics({ register: this.registry });
  }
}
