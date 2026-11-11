import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '../../common/errors/domain.errors';
import { UserRole } from '../users/domain/user-role.enum';
import { PasswordHasher } from '../users/password-hasher.service';
import type { UserEntity } from '../users/user.entity';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'u1',
    fullName: 'Ana',
    email: 'ana@pintotech.ec',
    role: UserRole.RECEPCIONISTA,
    isActive: true,
    passwordHash: 'hash',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserEntity;

  const users = { findByEmailWithPassword: jest.fn(), touchLastLogin: jest.fn() };
  const hasher = { compare: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
  const config = { get: jest.fn().mockReturnValue('8h') };

  const service = new AuthService(
    users as unknown as UsersRepository,
    hasher as unknown as PasswordHasher,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('emite token con credenciales válidas', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);
    hasher.compare.mockResolvedValue(true);

    const result = await service.login({ email: user.email, password: 'Clave2026' });

    expect(result.accessToken).toBe('token');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', role: UserRole.RECEPCIONISTA }),
    );
    expect(users.touchLastLogin).toHaveBeenCalledWith('u1');
  });

  it('rechaza contraseña incorrecta', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);
    hasher.compare.mockResolvedValue(false);
    await expect(service.login({ email: user.email, password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rechaza usuario inactivo', async () => {
    users.findByEmailWithPassword.mockResolvedValue({ ...user, isActive: false });
    hasher.compare.mockResolvedValue(true);
    await expect(service.login({ email: user.email, password: 'Clave2026' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rechaza correo inexistente con el mismo mensaje', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', password: 'y' })).rejects.toThrow(
      'Correo o contraseña incorrectos',
    );
  });
});
