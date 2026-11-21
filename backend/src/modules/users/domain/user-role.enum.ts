/**
 * Objetivo: roles del personal de PINTOTECH.
 *  - ADMIN: dueño/gerente. Todo, incluida la gestión de usuarios.
 *  - RECEPCIONISTA: registra ingresos, clientes, entregas y genera comprobantes.
 *  - TECNICO: diagnostica, cotiza, repara y documenta el registro interno.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  RECEPCIONISTA = 'RECEPCIONISTA',
  TECNICO = 'TECNICO',
}
