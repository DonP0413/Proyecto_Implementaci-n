/**
 * Objetivo: autorización por rol (RBAC). Se ejecuta después de JwtAuthGuard.
 * El rol ADMIN tiene acceso a todo.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/auth.decorators';
import type { AuthUser } from '../auth/auth-user.interface';
import { UserRole } from '../../modules/users/domain/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw new ForbiddenException();
    if (user.role === UserRole.ADMIN || required.includes(user.role)) return true;

    throw new ForbiddenException('Su rol no tiene permiso para esta operación');
  }
}
