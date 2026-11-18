/**
 * Objetivo: dejar PINTOTECH como recién instalada (lo invoca resetear-app.bat).
 *   1. Muestra cuántos datos hay y pide escribir BORRAR para confirmar.
 *   2. Cierra la aplicación si está abierta.
 *   3. MUEVE la base de datos (backend\data) y los archivos subidos
 *      (backend\storage) a backups\reseteo-AAAA-MM-DD_HH-MM-SS: nada se
 *      elimina definitivamente; para volver atrás basta con devolverlas.
 * La configuración (backend\.env) se conserva. Al iniciar de nuevo se crea una
 * base vacía con el administrador inicial de backend\.env.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const requireBackend = createRequire(path.join(backend, 'package.json'));

const envFile = path.join(backend, '.env');
const envText = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
const envValue = (key) => new RegExp(`^${key}=(.*)$`, 'm').exec(envText)?.[1]?.trim();

const dbPath = path.resolve(backend, process.env.DB_PATH ?? envValue('DB_PATH') ?? path.join('data', 'pintotech.sqlite'));
const dataDir = path.dirname(dbPath);
const storageDir = path.resolve(backend, process.env.STORAGE_LOCAL_PATH ?? envValue('STORAGE_LOCAL_PATH') ?? 'storage');

const fail = (msg) => {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
};

const ask = (prompt) =>
  new Promise((resolve) => {
    process.stdout.write(prompt);
    let data = '';
    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      data += chunk;
      if (data.includes('\n') || !process.stdin.isTTY) finish();
    };
    const finish = () => {
      process.stdin.off('data', onData);
      process.stdin.pause();
      if (!process.stdin.isTTY) process.stdout.write('\n');
      resolve(data.split(/\r?\n/)[0].trim());
    };
    process.stdin.on('data', onData);
    process.stdin.once('end', finish);
    process.stdin.resume();
  });

console.log('\n  === PINTOTECH - Resetear la aplicación ===\n');

const hasData = existsSync(dataDir);
const hasStorage = existsSync(storageDir);
if (!hasData && !hasStorage) {
  console.log('  La aplicación no tiene datos: ya está como recién instalada.\n');
  process.exit(0);
}

// --------------------------------------------------------------- resumen
if (existsSync(dbPath)) {
  try {
    const Database = requireBackend('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const count = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
    console.log('  Se borrará TODA la información de la aplicación:');
    console.log(`    - Órdenes de trabajo: ${count('work_orders')}`);
    console.log(`    - Clientes:           ${count('clients')}`);
    console.log(`    - Usuarios:           ${count('users')}`);
    console.log('    - Fotos, documentos y PDF guardados');
    db.close();
  } catch {
    console.log('  Se borrará TODA la información de la aplicación (base de datos y archivos).');
  }
} else {
  console.log('  Se borrarán los archivos guardados de la aplicación.');
}
console.log('\n  Se conserva la configuración (backend\\.env). Al volver a iniciar, la aplicación');
console.log('  quedará vacía con el administrador inicial de backend\\.env.');
console.log('  Por seguridad se guardará una copia en la carpeta "backups".\n');

const answer = await ask('  Para confirmar escriba BORRAR (en mayúsculas) y presione Enter: ');
if (answer !== 'BORRAR') {
  console.log('\n  Cancelado. No se modificó nada.\n');
  process.exit(0);
}

// --------------------------------------------------------------- cerrar la app
console.log('\n  Cerrando la aplicación si está abierta...');
const stop = spawnSync(process.execPath, [path.join(root, 'scripts', 'detener-local.mjs')], { stdio: 'inherit' });
if (stop.status !== 0) fail('no se pudo cerrar la aplicación. Ciérrela con detener.bat y vuelva a intentarlo.');

// --------------------------------------------------------------- mover a respaldo
// Fecha y hora LOCAL del equipo (no UTC), para que el nombre coincida con la hora real.
const now = new Date();
const two = (n) => String(n).padStart(2, '0');
const stamp =
  `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}_` +
  `${two(now.getHours())}-${two(now.getMinutes())}-${two(now.getSeconds())}`;
const backupDir = path.join(root, 'backups', `reseteo-${stamp}`);
mkdirSync(backupDir, { recursive: true });

const move = (from, name) => {
  if (!existsSync(from)) return;
  // Reintentos: Windows puede tardar un instante en liberar los archivos tras cerrar la app.
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(from, path.join(backupDir, name));
      return;
    } catch (error) {
      if (attempt >= 10) {
        fail(`no se pudo mover ${from} (${error.code ?? error.message}). Cierre los programas que la usen e intente de nuevo.`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
};
move(dataDir, 'data');
move(storageDir, 'storage');

console.log('\n  Listo: la aplicación quedó como recién instalada.');
console.log(`  Copia de los datos anteriores: ${backupDir}`);
console.log('  (Para recuperarlos: cierre la app y devuelva "data" y "storage" a la carpeta backend.)');
console.log('\n  Ejecute iniciar.bat para abrir la aplicación.\n');
