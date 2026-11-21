/**
 * Objetivo: contrato del usuario autenticado que viaja en request.user.
 */
import type { UserRole } from '../../modules/users/domain/user-role.enum';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  username: string;
  /** Tokens emitidos antes del cambio a nombre de usuario. */
  email?: string;
  name: string;
  role: UserRole;
}
