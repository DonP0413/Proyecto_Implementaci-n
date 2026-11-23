/**
 * Objetivo: decoradores de seguridad declarativa.
 *  - @Public(): excluye un endpoint del JwtAuthGuard global.
 *  - @Roles(...): restringe por rol (RBAC) evaluado por RolesGuard.
 *  - @CurrentUser(): inyecta el usuario autenticado en el handler.
 */
import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import type { UserRole } from '../../modules/users/domain/user-role.enum';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});
