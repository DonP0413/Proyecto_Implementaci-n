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
    username: 'ana.torres',
    role: UserRole.RECEPCIONISTA,
    isActive: true,
    passwordHash: 'hash',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserEntity;

  const users = { findByUsernameWithPassword: jest.fn(), touchLastLogin: jest.fn() };
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
    users.findByUsernameWithPassword.mockResolvedValue(user);
    hasher.compare.mockResolvedValue(true);

    const result = await service.login({ username: user.username, password: 'Clave2026' });

    expect(result.accessToken).toBe('token');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', role: UserRole.RECEPCIONISTA }),
    );
    expect(users.touchLastLogin).toHaveBeenCalledWith('u1');
  });

  it('rechaza contraseña incorrecta', async () => {
    users.findByUsernameWithPassword.mockResolvedValue(user);
    hasher.compare.mockResolvedValue(false);
    await expect(service.login({ username: user.username, password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rechaza usuario inactivo', async () => {
    users.findByUsernameWithPassword.mockResolvedValue({ ...user, isActive: false });
    hasher.compare.mockResolvedValue(true);
    await expect(service.login({ username: user.username, password: 'Clave2026' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rechaza usuario inexistente con el mismo mensaje', async () => {
    users.findByUsernameWithPassword.mockResolvedValue(null);
    await expect(service.login({ username: 'nadie', password: 'y' })).rejects.toThrow(
      'Usuario o contraseña incorrectos',
    );
  });
});
