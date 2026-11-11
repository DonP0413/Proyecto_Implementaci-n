/**
 * Objetivo: contrato del usuario autenticado que viaja en request.user.
 */
import type { UserRole } from '../../modules/users/domain/user-role.enum';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
}
