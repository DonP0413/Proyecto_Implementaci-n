/**
 * Objetivo: preparar la carpeta desktop/servidor que se empaqueta dentro de la
 * aplicación de escritorio:
 *   servidor/backend     -> backend compilado + dependencias de producción
 *                           (better-sqlite3 recompilado para la versión de Electron)
 *   servidor/interfaz    -> SPA compilada (dist de la raíz)
 *   servidor/migraciones -> database/migrations
 *
 * Uso:  npm run preparar              (compila todo y arma la carpeta)
 *       npm run preparar -- --rapido  (no recompila frontend/backend si ya existen)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(desktop, '..');
const backend = path.join(root, 'backend');
const out = path.join(desktop, 'servidor');
const rapido = process.argv.includes('--rapido');

const log = (msg) => console.log(`[preparar] ${msg}`);
const run = (cmd, cwd) => {
  log(`${cmd}  (en ${path.relative(root, cwd) || '.'})`);
  const result = spawnSync(cmd, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\n[preparar] ERROR: falló "${cmd}"`);
    process.exit(1);
  }
};

// 1. Compilar interfaz y servidor
if (!rapido || !existsSync(path.join(root, 'dist', 'index.html'))) run('npm run build', root);
if (!rapido || !existsSync(path.join(backend, 'dist', 'main.js'))) run('npm run build', backend);

// 2. Armar la carpeta servidor/
log('Armando desktop/servidor ...');
rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, 'backend'), { recursive: true });
cpSync(path.join(backend, 'dist'), path.join(out, 'backend', 'dist'), { recursive: true });
for (const file of ['package.json', 'package-lock.json']) {
  cpSync(path.join(backend, file), path.join(out, 'backend', file));
}
cpSync(path.join(root, 'dist'), path.join(out, 'interfaz'), { recursive: true });
cpSync(path.join(root, 'database', 'migrations'), path.join(out, 'migraciones'), { recursive: true });

// Los mapas de código (*.map) sólo sirven para depurar y el del frontend incluye el
// código fuente original completo: no se distribuyen. En desarrollo se siguen generando.
const removeSourceMaps = (dir) => {
  let removed = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removed += removeSourceMaps(full);
    else if (entry.name.endsWith('.map')) {
      rmSync(full);
      removed += 1;
    }
  }
  return removed;
};
const maps = removeSourceMaps(path.join(out, 'backend', 'dist')) + removeSourceMaps(path.join(out, 'interfaz'));
log(`Mapas de código excluidos: ${maps}`);

// 3. Dependencias de producción del backend (sin las de desarrollo)
run('npm ci --omit=dev --no-audit --no-fund', path.join(out, 'backend'));

// 4. better-sqlite3 es un módulo nativo: necesita el binario hecho para el Node de Electron.
//    Primero se descarga el precompilado oficial (no requiere Visual Studio); si no existe
//    para esta versión de Electron, se intenta compilar con @electron/rebuild.
const electronVersion = JSON.parse(
  readFileSync(path.join(desktop, 'node_modules', 'electron', 'package.json'), 'utf8'),
).version;
const sqliteDir = path.join(out, 'backend', 'node_modules', 'better-sqlite3');
const prebuilt = spawnSync(
  `node "${path.join(out, 'backend', 'node_modules', 'prebuild-install', 'bin.js')}" --runtime electron --target ${electronVersion} --arch x64`,
  { cwd: sqliteDir, stdio: 'inherit', shell: true },
);
if (prebuilt.status !== 0) {
  log(`No hay binario precompilado de better-sqlite3 para Electron ${electronVersion}; se compilará (requiere Visual Studio Build Tools).`);
  run(
    `npx electron-rebuild --version ${electronVersion} --module-dir "${path.join(out, 'backend')}" --only better-sqlite3 --force`,
    desktop,
  );
}
if (!existsSync(path.join(sqliteDir, 'build', 'Release', 'better_sqlite3.node'))) {
  console.error('\n[preparar] ERROR: no se generó better_sqlite3.node');
  process.exit(1);
}

log('Listo.');
