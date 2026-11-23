/**
 * Objetivo: módulo de autenticación. Exporta JwtModule para que el
 * JwtAuthGuard global (registrado en AppModule) pueda verificar tokens.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: (config.get<string>('jwt.expiresIn') ?? '8h') as JwtSignOptions['expiresIn'],
          issuer: 'pintotech-api',
          audience: 'pintotech-web',
        },
        verifyOptions: { issuer: 'pintotech-api', audience: 'pintotech-web', algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
