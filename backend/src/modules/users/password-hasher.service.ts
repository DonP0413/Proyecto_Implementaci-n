/**
 * Objetivo: abstraer el algoritmo de hash de contraseñas (bcrypt, costo 12).
 * bcryptjs (JS puro) evita compilar binarios nativos en la imagen Alpine.
 */
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordHasher {
  private readonly rounds = 12;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
