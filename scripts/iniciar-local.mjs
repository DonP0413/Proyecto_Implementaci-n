/**
 * Objetivo: iniciar PINTOTECH como aplicación LOCAL (lo invoca iniciar.bat).
 *   1. Crea backend/.env la primera vez (secreto JWT aleatorio, SQLite, admin inicial).
 *   2. Compila frontend y backend si no están compilados (o con --reconstruir).
 *   3. Si la aplicación ya está abierta, sólo abre el navegador.
 *   4. Inicia el backend EN SEGUNDO PLANO (también sirve la interfaz), abre el
 *      navegador cuando responde y termina: la consola se cierra sola.
 *      La aplicación sigue abierta hasta ejecutar detener.bat (o apagar el PC).
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const envFile = path.join(backend, '.env');
const rebuild = process.argv.includes('--reconstruir');
const logDir = path.join(backend, 'logs');
const logFile = path.join(logDir, 'pintotech.log');
const pidFile = path.join(backend, 'data', 'pintotech.pid');

const log = (msg) => console.log(`[PINTOTECH] ${msg}`);
const fail = (msg) => {
  console.error(`\n[PINTOTECH] ERROR: ${msg}\n`);
  process.exit(1);
};

const run = (args, cwd) => {
  const result = spawnSync(`npm ${args.join(' ')}`, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) fail(`falló "npm ${args.join(' ')}" en ${cwd}`);
};

// ---------------------------------------------------------------- 1. .env
if (!existsSync(envFile)) {
  log('Primera ejecución: creando la configuración local (backend\\.env)...');
  writeFileSync(
    envFile,
    [
      '# Configuración LOCAL de PINTOTECH (generada por iniciar.bat). Puede editarla.',
      'NODE_ENV=production',
      'PORT=3000',
      'LOG_LEVEL=warn',
      'SWAGGER_ENABLED=false',
      '',
      '# Base de datos SQLite (archivo único). Haga copias de esta carpeta como respaldo.',
      'DB_PATH=data/pintotech.sqlite',
      'STORAGE_LOCAL_PATH=./storage',
      '',
      `JWT_SECRET=${randomBytes(48).toString('base64url')}`,
      'JWT_EXPIRES_IN=12h',
      '',
      '# Datos de la empresa que aparecen en los PDF',
      'COMPANY_NAME=PINTOTECH',
      'COMPANY_ADDRESS=Quito, Ecuador',
      'COMPANY_PHONE=0999999999',
      'COMPANY_EMAIL=',
      'COMPANY_WEBSITE=',
      'WORK_ORDER_PREFIX=PT',
      'APP_TIMEZONE=America/Guayaquil',
      '',
      '# Administrador inicial: se crea sólo si la base no tiene usuarios.',
      '# Cambie la contraseña desde la aplicación después del primer ingreso.',
      'ADMIN_EMAIL=admin@pintotech.local',
      'ADMIN_PASSWORD=Cambiar2026',
      'ADMIN_NAME=Administrador PINTOTECH',
      '',
    ].join('\r\n'),
  );
  log('Usuario inicial: ver ADMIN_EMAIL / ADMIN_PASSWORD en backend\\.env');
}

const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*[A-Z_]+\s*=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);
const port = Number(process.env.PORT ?? env.PORT ?? 3000);
const url = `http://localhost:${port}`;

// ---------------------------------------------------------------- 2. compilar
if (rebuild || !existsSync(path.join(root, 'dist', 'index.html'))) {
  log('Compilando la interfaz (puede tardar un minuto)...');
  run(['run', 'build'], root);
}
if (rebuild || !existsSync(path.join(backend, 'dist', 'main.js'))) {
  log('Compilando el servidor...');
  run(['run', 'build'], backend);
}

// ---------------------------------------------------------------- 3/4. iniciar
const isUp = async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
};

const openBrowser = () => {
  if (process.env.PINTOTECH_NO_BROWSER) return;
  spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref();
};

if (await isUp()) {
  log(`La aplicación ya está abierta en ${url}`);
  openBrowser();
  process.exit(0);
}

log('Iniciando...');
// El servidor corre en SEGUNDO PLANO (sin ventana): esta consola se cierra sola cuando la app está lista.
// Sus mensajes quedan en backend\logs\pintotech.log. Para cerrar la app: detener.bat
mkdirSync(logDir, { recursive: true });
if (existsSync(logFile)) renameSync(logFile, `${logFile}.anterior`);
const out = openSync(logFile, 'a');
const server = spawn(process.execPath, [path.join('dist', 'main.js')], {
  cwd: backend,
  detached: true,
  windowsHide: true,
  stdio: ['ignore', out, out],
});
let exitCode = null;
server.on('exit', (code) => (exitCode = code ?? 1));

const lastLog = () => readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-15).join('\n');

for (let i = 0; i < 120; i++) {
  if (exitCode !== null) fail(`el servidor se detuvo al iniciar. Últimos mensajes:\n\n${lastLog()}`);
  if (await isUp()) {
    mkdirSync(path.dirname(pidFile), { recursive: true });
    writeFileSync(pidFile, String(server.pid));
    server.unref();
    log(`Aplicación lista en ${url}`);
    log('Se ejecuta en segundo plano. Para cerrarla use detener.bat');
    openBrowser();
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
fail(`la aplicación no respondió a tiempo. Revise ${logFile}`);
