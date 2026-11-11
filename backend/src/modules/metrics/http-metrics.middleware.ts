/**
 * Objetivo: middleware que mide la latencia de cada petición HTTP y la
 * publica en el histograma Prometheus. Usa la ruta "plantilla"
 * (/work-orders/:id) y no la URL real, para no explotar la cardinalidad.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const end = this.metrics.httpRequestDuration.startTimer();
    res.on('finish', () => {
      const route = (req.route as { path?: string } | undefined)?.path;
      const routeLabel = route ? `${req.baseUrl ?? ''}${route}` : 'unmatched';
      end({ method: req.method, route: routeLabel, status_code: String(res.statusCode) });
    });
    next();
  }
}
