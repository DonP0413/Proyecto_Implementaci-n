/**
 * Objetivo: exponer GET /metrics para Prometheus. Si METRICS_TOKEN está
 * definido, exige `Authorization: Bearer <token>` (recomendado en producción).
 */
import { Controller, Get, Header, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/auth.decorators';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Headers('authorization') authorization?: string): Promise<string> {
    const token = this.config.get<string>('metrics.token');
    if (token && authorization !== `Bearer ${token}`) throw new UnauthorizedException();
    return this.metrics.registry.metrics();
  }
}
