/**
 * Objetivo: casos de uso de gestión del personal (alta, edición, baja lógica,
 * reseteo de contraseña). Nunca se eliminan usuarios físicamente porque
 * están referenciados en el historial de órdenes (auditoría).
 */
import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.interface';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/domain.errors';
import { UserRole } from './domain/user-role.enum';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { PasswordHasher } from './password-hasher.service';
import { UserEntity } from './user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    if (await this.users.existsByEmail(dto.email)) {
      throw new ConflictError('Ya existe un usuario con ese correo', 'USER_EMAIL_TAKEN');
    }
    const user = this.users.create({
      fullName: dto.fullName,
      email: dto.email,
      role: dto.role,
      passwordHash: await this.hasher.hash(dto.password),
      isActive: true,
    });
    const saved = await this.users.save(user);
    return UserResponseDto.from(saved);
  }

  async list(): Promise<UserResponseDto[]> {
    return (await this.users.findAll()).map(UserResponseDto.from);
  }

  async listTechnicians(): Promise<UserResponseDto[]> {
    const users = await this.users.findAll({ activeOnly: true });
    return users
      .filter((u) => u.role === UserRole.TECNICO || u.role === UserRole.ADMIN)
      .map(UserResponseDto.from);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<UserResponseDto> {
    const user = await this.getEntity(id);
    if (actor.id === id && (dto.isActive === false || (dto.role && dto.role !== user.role))) {
      throw new BusinessRuleError('No puede desactivarse ni cambiar su propio rol', 'SELF_MODIFICATION');
    }
    Object.assign(user, dto);
    return UserResponseDto.from(await this.users.save(user));
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<void> {
    await this.getEntity(id);
    await this.users.updatePassword(id, await this.hasher.hash(dto.password));
  }

  async getEntity(id: string): Promise<UserEntity> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Usuario', id);
    return user;
  }
}
