/**
 * Objetivo: guard global de autenticación. Todo endpoint requiere un JWT
 * Bearer válido salvo que esté marcado con @Public(). Excepción acotada: un GET
 * a un PDF o adjunto puede autenticarse con ?dl=<token de descarga> (ver
 * download-link.ts), ligado a esa ruta exacta y válido 2 minutos.
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { UsersRepository } from '../../modules/users/users.repository';
import type { AuthUser, JwtPayload } from '../auth/auth-user.interface';
import { DOWNLOAD_AUDIENCE, DOWNLOADABLE_PATH, type DownloadTokenPayload } from '../auth/download-link';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);
    if (!token) {
      if (await this.acceptDownloadLink(request)) return this.assertActiveUser(request);
      throw new UnauthorizedException('Token de acceso requerido');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    request.user = {
      id: payload.sub,
      username: payload.username ?? payload.email ?? '',
      fullName: payload.name,
      role: payload.role,
    };
    return this.assertActiveUser(request);
  }

  /**
   * El token sólo prueba quién inició sesión. En cada petición se confirma en la
   * base que el usuario sigue activo y se toma su rol ACTUAL: si el administrador
   * lo desactiva o le cambia el rol, la sesión abierta deja de servir o se ajusta
   * de inmediato (antes seguía funcionando hasta que el token expiraba).
   */
  private async assertActiveUser(request: Request & { user?: AuthUser }): Promise<true> {
    const user = request.user ? await this.users.findById(request.user.id) : null;
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Su usuario fue desactivado. Comuníquese con el administrador');
    }
    request.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    return true;
  }

  /** Enlace temporal de descarga: sólo GET, sólo la ruta para la que se emitió. */
  private async acceptDownloadLink(request: Request & { user?: AuthUser }): Promise<boolean> {
    const token = request.query?.dl;
    if (request.method !== 'GET' || typeof token !== 'string' || !token) return false;
    const prefix = `/${this.config.get<string>('apiPrefix') ?? 'api/v1'}`;
    const path = request.path.startsWith(prefix) ? request.path.slice(prefix.length) : request.path;
    if (!DOWNLOADABLE_PATH.test(path)) return false;
    try {
      const payload = await this.jwtService.verifyAsync<DownloadTokenPayload>(token, {
        audience: DOWNLOAD_AUDIENCE,
      });
      if (payload.path !== path) return false;
      request.user = {
        id: payload.sub,
        username: payload.username,
        fullName: payload.name,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException(
        'El enlace de descarga expiró. Vuelva a abrir el documento desde la aplicación',
      );
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
