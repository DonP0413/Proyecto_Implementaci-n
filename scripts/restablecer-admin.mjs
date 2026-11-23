/**
 * Objetivo: restablecer la contraseña de un ADMINISTRADOR directamente en la
 * base SQLite local (lo invoca restablecer-admin.bat). Es la vía de
 * recuperación cuando el administrador olvidó su contraseña: sólo puede usarla
 * quien tiene acceso a este equipo. Funciona con la aplicación abierta o cerrada.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const requireBackend = createRequire(path.join(backend, 'package.json'));

/** Misma regla que la aplicación (UsersDto): 8-72 caracteres, letras y números. */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const BCRYPT_ROUNDS = 12;

const fail = (msg) => {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
};

// ------------------------------------------------------------------ entrada
const stdin = process.stdin;
let pendingLines = null;

/** Lee una línea. Con mask=true muestra asteriscos (sólo en una consola real). */
const ask = (prompt, { mask = false } = {}) =>
  new Promise((resolve) => {
    process.stdout.write(prompt);
    if (!stdin.isTTY) {
      // Entrada redirigida (pruebas): una respuesta por línea.
      const take = () => {
        const line = pendingLines.shift() ?? '';
        process.stdout.write(mask ? `${'*'.repeat(line.length)}\n` : `${line}\n`);
        resolve(line);
      };
      if (pendingLines) return take();
      let data = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => (data += chunk));
      stdin.on('end', () => {
        pendingLines = data.split(/\r?\n/);
        take();
      });
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          process.stdout.write('\n');
          process.exit(130); // Ctrl+C
        } else if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        } else if (ch === '\b' || ch === '\u007f') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (ch >= ' ') {
          value += ch;
          process.stdout.write(mask ? '*' : ch);
        }
      }
    };
    stdin.on('data', onData);
  });

// ------------------------------------------------------------------ base de datos
const envFile = path.join(backend, '.env');
const envDbPath = existsSync(envFile) ? /^DB_PATH=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim() : undefined;
const dbPath = path.resolve(backend, process.env.DB_PATH ?? envDbPath ?? path.join('data', 'pintotech.sqlite'));

console.log('\n  === PINTOTECH - Restablecer contraseña de administrador ===\n');

if (!existsSync(dbPath)) {
  fail(`no se encontró la base de datos (${dbPath}).\n  Inicie la aplicación al menos una vez con iniciar.bat.`);
}

let Database;
let bcrypt;
try {
  Database = requireBackend('better-sqlite3');
  bcrypt = requireBackend('bcryptjs');
} catch {
  fail('faltan las dependencias del servidor. Ejecute primero iniciar.bat.');
}

const db = new Database(dbPath);
db.pragma('busy_timeout = 5000'); // por si la aplicación está escribiendo en ese momento

const admins = db
  .prepare(`SELECT id, email, full_name AS fullName, is_active AS isActive FROM users WHERE role = 'ADMIN' ORDER BY email`)
  .all();
if (admins.length === 0) fail('no hay administradores registrados en la base de datos.');

console.log('  Administradores registrados:');
admins.forEach((a, i) =>
  console.log(`    ${i + 1}) ${a.email}  (${a.fullName})${a.isActive ? '' : '  [DESACTIVADO]'}`),
);
console.log('');

let admin;
if (admins.length === 1) {
  admin = admins[0];
  console.log(`  Se restablecerá la contraseña de ${admin.email}\n`);
} else {
  while (!admin) {
    const choice = Number((await ask('  Elija el número del administrador: ')).trim());
    admin = admins[choice - 1];
    if (!admin) console.log(`  Opción inválida. Escriba un número del 1 al ${admins.length}.`);
  }
  console.log('');
}

let password;
for (let attempt = 1; !password; attempt++) {
  if (attempt > 5) fail('demasiados intentos. Vuelva a ejecutar restablecer-admin.bat.');
  const first = await ask('  Nueva contraseña (mín. 8 caracteres, letras y números): ', { mask: true });
  if (!PASSWORD_RULE.test(first)) {
    console.log('  La contraseña debe tener entre 8 y 72 caracteres e incluir letras y números.\n');
    continue;
  }
  const second = await ask('  Repita la nueva contraseña:                              ', { mask: true });
  if (first !== second) {
    console.log('  Las contraseñas no coinciden. Intente de nuevo.\n');
    continue;
  }
  password = first;
}

const changes = db
  .prepare(
    `UPDATE users
        SET password_hash = ?, is_active = 1, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
      WHERE id = ? AND role = 'ADMIN'`,
  )
  .run(bcrypt.hashSync(password, BCRYPT_ROUNDS), admin.id).changes;
db.close();

if (changes !== 1) fail('no se pudo actualizar la contraseña.');
console.log(`\n  Contraseña actualizada${admin.isActive ? '' : ' y cuenta reactivada'}.`);
console.log(`  Ya puede ingresar con ${admin.email} y la nueva contraseña.\n`);
