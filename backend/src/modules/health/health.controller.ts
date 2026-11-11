/**
 * Objetivo: health checks para Docker, balanceadores y monitoreo.
 *  - GET /health/live  : el proceso responde (liveness). Sin dependencias.
 *  - GET /health/ready : BD y almacenamiento operativos (readiness). 503 si no.
 */
import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/auth.decorators';
import { FILE_STORAGE, FileStorage } from '../../infrastructure/storage/file-storage.port';

type CheckResult = { status: 'up' | 'down'; latencyMs: number; error?: string };

const timed = async (fn: () => Promise<unknown>): Promise<CheckResult> => {
  const start = Date.now();
  try {
    await fn();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    return { status: 'down', latencyMs: Date.now() - start, error: (error as Error).message };
  }
};

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (BD + almacenamiento)' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const [database, storage] = await Promise.all([
      timed(() => this.dataSource.query('SELECT 1')),
      timed(() => this.storage.healthCheck()),
    ]);
    const healthy = database.status === 'up' && storage.status === 'up';
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? 'ok' : 'error',
      checks: { database, storage },
      version: process.env.APP_VERSION ?? 'dev',
      timestamp: new Date().toISOString(),
    };
  }
}
