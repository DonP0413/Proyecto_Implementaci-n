/**
 * Objetivo: caso de uso de inicio de sesión. Emite un JWT firmado (HS256) con
 * id, usuario, nombre y rol. Mensaje de error genérico para no revelar si el
 * usuario existe (previene enumeración de usuarios).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, JwtPayload } from '../../common/auth/auth-user.interface';
import {
  DOWNLOAD_AUDIENCE,
  DOWNLOAD_TOKEN_TTL_SECONDS,
  type DownloadTokenPayload,
} from '../../common/auth/download-link';
import { UnauthorizedError } from '../../common/errors/domain.errors';
import { UserResponseDto } from '../users/dto/user.dto';
import { PasswordHasher } from '../users/password-hasher.service';
import { UsersRepository } from '../users/users.repository';
import { LoginDto, LoginResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Enlace temporal (2 min) para abrir UN archivo protegido en una pestaña nueva
   * con su nombre y extensión reales. Sólo sirve para esa ruta y no como sesión.
   */
  async createDownloadToken(user: AuthUser, path: string): Promise<{ token: string; expiresIn: number }> {
    const payload: DownloadTokenPayload = {
      sub: user.id,
      username: user.username,
      name: user.fullName,
      role: user.role,
      path,
    };
    const token = await this.jwt.signAsync(payload, {
      audience: DOWNLOAD_AUDIENCE,
      expiresIn: DOWNLOAD_TOKEN_TTL_SECONDS,
    });
    return { token, expiresIn: DOWNLOAD_TOKEN_TTL_SECONDS };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findByUsernameWithPassword(dto.username);
    const valid = user ? await this.hasher.compare(dto.password, user.passwordHash) : false;

    if (!user || !valid || !user.isActive) {
      this.logger.warn(
        { username: dto.username, reason: !user ? 'no_user' : !valid ? 'bad_password' : 'inactive' },
        'Intento de inicio de sesión fallido',
      );
      throw new UnauthorizedError('Usuario o contraseña incorrectos', 'INVALID_CREDENTIALS');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      name: user.fullName,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload);
    await this.users.touchLastLogin(user.id);
    this.logger.log({ userId: user.id }, 'Inicio de sesión exitoso');

    return {
      accessToken,
      expiresIn: this.config.get<string>('jwt.expiresIn') ?? '8h',
      user: UserResponseDto.from(user),
    };
  }
}
