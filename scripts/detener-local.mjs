/**
 * Objetivo: cerrar la aplicación local que iniciar.bat dejó en segundo plano
 * (lo invoca detener.bat). Usa el PID guardado al iniciar; si no existe,
 * busca el proceso que escucha en el puerto de la aplicación.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const pidFile = path.join(backend, 'data', 'pintotech.pid');
const envFile = path.join(backend, '.env');

const envPort = existsSync(envFile) ? /^PORT=(\d+)/m.exec(readFileSync(envFile, 'utf8'))?.[1] : undefined;
const port = Number(process.env.PORT ?? envPort ?? 3000);
const log = (msg) => console.log(`[PINTOTECH] ${msg}`);

const isUp = async () => {
  try {
    return (await fetch(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
};

const kill = (pid) => spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }).status === 0;

/** PID del proceso que escucha en el puerto (por si se perdió el archivo .pid). */
const pidFromPort = () => {
  const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout ?? '';
  // No depende del idioma de Windows (LISTENING / ESCUCHANDO): un socket en escucha
  // tiene como dirección remota 0.0.0.0:0 o [::]:0.
  const listening = new RegExp(`:${port}\\s+(0\\.0\\.0\\.0|\\[::\\]):0\\s`);
  const line = out.split(/\r?\n/).find((l) => listening.test(l));
  return line ? Number(line.trim().split(/\s+/).pop()) : null;
};

if (!(await isUp())) {
  log('La aplicación no está abierta.');
  rmSync(pidFile, { force: true });
  process.exit(0);
}

const savedPid = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : null;
const stopped = (savedPid && kill(savedPid)) || (() => {
  const pid = pidFromPort();
  return pid ? kill(pid) : false;
})();
rmSync(pidFile, { force: true });

for (let i = 0; i < 20 && (await isUp()); i++) await new Promise((r) => setTimeout(r, 250));
if (stopped && !(await isUp())) {
  log('Aplicación cerrada.');
} else {
  console.error('[PINTOTECH] No se pudo cerrar la aplicación. Reinicie el equipo o ciérrela desde el Administrador de tareas (node.exe).');
  process.exit(1);
}
