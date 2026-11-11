/**
 * Objetivo: guard global de autenticación. Todo endpoint requiere un JWT
 * Bearer válido salvo que esté marcado con @Public().
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import type { AuthUser, JwtPayload } from '../auth/auth-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Token de acceso requerido');

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = { id: payload.sub, email: payload.email, fullName: payload.name, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
