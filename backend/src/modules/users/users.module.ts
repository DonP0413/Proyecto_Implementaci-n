/** Objetivo: ensamblar el módulo de usuarios (Dependency Injection). */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasher } from './password-hasher.service';
import { UserEntity } from './user.entity';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, PasswordHasher],
  exports: [UsersService, UsersRepository, PasswordHasher],
})
export class UsersModule {}
