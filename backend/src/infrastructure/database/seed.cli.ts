/**
 * Objetivo: comando `npm run seed`. Crea (idempotente) el usuario
 * administrador inicial a partir de ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 * La contraseña se hashea con bcrypt; nunca se guarda en texto plano.
 */
import * as bcrypt from 'bcryptjs';
import { createPgClientFromEnv } from './pg-client.factory';

const main = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Administrador';
  if (!email || !password) {
    throw new Error('Defina ADMIN_EMAIL y ADMIN_PASSWORD para crear el administrador inicial');
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres');

  const client = createPgClientFromEnv();
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email]);
    if (rowCount && rowCount > 0) {
      console.log(`[seed] El usuario ${email} ya existe; no se modifica.`);
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, lower($2), $3, 'ADMIN')`,
      [name, email, hash],
    );
    console.log(`[seed] Administrador ${email} creado.`);
  } finally {
    await client.end();
  }
};

main().catch((error: Error) => {
  console.error(`[seed] ERROR: ${error.message}`);
  process.exit(1);
});
