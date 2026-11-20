/**
 * Objetivo: Repository Pattern para usuarios. Encapsula TypeORM; los
 * servicios no construyen queries directamente.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './domain/user-role.enum';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>) {}

  create(data: Partial<UserEntity>): UserEntity {
    return this.repo.create(data);
  }

  save(user: UserEntity): Promise<UserEntity> {
    return this.repo.save(user);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByUsernameWithPassword(username: string): Promise<UserEntity | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('lower(u.username) = lower(:username)', { username })
      .getOne();
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.repo
      .createQueryBuilder('u')
      .where('lower(u.username) = lower(:username)', { username })
      .getCount();
    return count > 0;
  }

  findAll(filter: { role?: UserRole; activeOnly?: boolean } = {}): Promise<UserEntity[]> {
    const qb = this.repo.createQueryBuilder('u').orderBy('u.fullName', 'ASC');
    if (filter.role) qb.andWhere('u.role = :role', { role: filter.role });
    if (filter.activeOnly) qb.andWhere('u.isActive = true');
    return qb.getMany();
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id }, { passwordHash });
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.repo.update({ id }, { lastLoginAt: new Date() });
  }
}
