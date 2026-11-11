/**
 * Objetivo: caso de uso de inicio de sesión. Emite un JWT firmado (HS256) con
 * id, correo, nombre y rol. Mensaje de error genérico para no revelar si el
 * correo existe (previene enumeración de usuarios).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../common/auth/auth-user.interface';
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

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const valid = user ? await this.hasher.compare(dto.password, user.passwordHash) : false;

    if (!user || !valid || !user.isActive) {
      this.logger.warn(
        { email: dto.email, reason: !user ? 'no_user' : !valid ? 'bad_password' : 'inactive' },
        'Intento de inicio de sesión fallido',
      );
      throw new UnauthorizedError('Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.fullName, role: user.role };
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
