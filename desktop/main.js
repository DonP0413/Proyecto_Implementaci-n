/**
 * Objetivo: proceso principal de la aplicación de escritorio PINTOTECH (Electron).
 *   1. Crea la configuración local la primera vez (%APPDATA%\PINTOTECH\configuracion.env)
 *      con un secreto JWT aleatorio. La contraseña del administrador inicial NO se
 *      escribe en ese archivo: se genera al azar, se pasa al servidor por variable de
 *      entorno, se guarda cifrada (DPAPI de Windows) sólo hasta que el usuario confirma
 *      que la anotó, y se muestra una sola vez.
 *   2. Inicia el servidor NestJS (que también sirve la interfaz) en un proceso
 *      aparte, con la base SQLite, archivos y registros en %APPDATA%\PINTOTECH.
 *   3. Abre la ventana cuando el servidor responde y lo detiene al cerrar.
 *   4. Opción "Compartir en la red local": el servidor escucha en 0.0.0.0 para
 *      que otros equipos entren desde el navegador con http://<IP>:<puerto>.
 */
const { app, BrowserWindow, Menu, clipboard, dialog, safeStorage, shell, utilityProcess } = require('electron');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const APP_NAME = 'PINTOTECH';

// ------------------------------------------------------------------ rutas
const resources = app.isPackaged ? process.resourcesPath : __dirname;
const serverDir = path.join(resources, 'servidor');
const dataRoot = app.getPath('userData'); // %APPDATA%\PINTOTECH
const paths = {
  config: path.join(dataRoot, 'configuracion.env'),
  db: path.join(dataRoot, 'datos', 'pintotech.sqlite'),
  storage: path.join(dataRoot, 'archivos'),
  logs: path.join(dataRoot, 'registros'),
  log: path.join(dataRoot, 'registros', 'servidor.log'),
  /** Contraseña inicial pendiente de confirmar, cifrada con DPAPI (no legible como texto). */
  pendingAdmin: path.join(dataRoot, 'admin-pendiente.bin'),
};

// ------------------------------------------------------------------ configuración
const DEFAULT_CONFIG = () =>
  [
    '# Configuración de PINTOTECH (aplicación de escritorio). Puede editarla y reiniciar la aplicación.',
    'PORT=3000',
    '# true = otros equipos de la red pueden entrar con http://<IP-de-este-equipo>:PORT',
    'COMPARTIR_EN_RED=false',
    'LOG_LEVEL=warn',
    'SWAGGER_ENABLED=false',
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
    '# Administrador inicial: se crea sólo si la base no tiene usuarios. Su contraseña es',
    '# aleatoria, NO se guarda en este archivo y se muestra una sola vez en el primer arranque.',
    'ADMIN_USER=admin',
    'ADMIN_NAME=Administrador PINTOTECH',
    '',
  ].join('\r\n');

/**
 * Contraseña legible para dictar o anotar: 3 grupos de 4 caracteres sin
 * caracteres ambiguos (0/O, 1/l/I). Siempre incluye letras y números.
 */
function randomPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b, i) => (i === 0 ? letters : i === 5 ? digits : all)[b % (i === 0 ? letters.length : i === 5 ? digits.length : all.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join('')).join('-');
}

const ensureConfig = () => {
  for (const dir of [path.dirname(paths.db), paths.storage, paths.logs]) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(paths.config)) fs.writeFileSync(paths.config, DEFAULT_CONFIG());
};

// ------------------------------------------------------------------ contraseña inicial pendiente
const savePendingAdmin = (password) => {
  if (!safeStorage.isEncryptionAvailable()) return; // sin cifrado disponible, sólo vive en memoria
  fs.writeFileSync(paths.pendingAdmin, safeStorage.encryptString(password));
};

const readPendingAdmin = () => {
  try {
    return safeStorage.decryptString(fs.readFileSync(paths.pendingAdmin));
  } catch {
    return null;
  }
};

const clearPendingAdmin = () => fs.rmSync(paths.pendingAdmin, { force: true });

/**
 * Decide la contraseña del administrador inicial para este arranque, sin dejarla
 * nunca en configuracion.env:
 *  - Si alguien la escribió a mano en la configuración (o quedó de una versión
 *    anterior), se pasa al archivo cifrado y se borra de la configuración.
 *  - Si hay una pendiente de confirmar (la app se cerró antes), se reutiliza.
 *  - Si la base todavía no existe, se genera una nueva al azar.
 */
const prepareAdminPassword = () => {
  const fromConfig = readConfig().ADMIN_PASSWORD;
  if (fromConfig) {
    savePendingAdmin(fromConfig);
    removeConfigKey('ADMIN_PASSWORD');
    return fromConfig;
  }
  const pending = readPendingAdmin();
  if (pending) return pending;
  if (fs.existsSync(paths.db)) return null;
  const generated = randomPassword();
  savePendingAdmin(generated);
  return generated;
};

/** Quita una clave del archivo de configuración (p. ej. la contraseña inicial ya usada). */
const removeConfigKey = (key) => {
  const text = fs.readFileSync(paths.config, 'utf8');
  const pattern = new RegExp(`^\\s*${key}\\s*=.*(\\r?\\n)?`, 'm');
  if (pattern.test(text)) fs.writeFileSync(paths.config, text.replace(pattern, ''));
};

/** ¿Estas credenciales permiten iniciar sesión? (el administrador inicial sigue con esa contraseña) */
const credentialsWork = async (port, username, password) => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Muestra la contraseña del administrador inicial y no deja continuar hasta
 * que el usuario confirme que la anotó. Después se borra de la configuración.
 */
const showInitialCredentials = async (username, password) => {
  let copied = false;
  for (;;) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: `${APP_NAME} — Usuario administrador`,
      message: 'Se creó el usuario administrador. Anote estos datos: no se volverán a mostrar.',
      detail:
        `Usuario:      ${username}\nContraseña:  ${password}\n\n` +
        (copied ? 'La contraseña se copió al portapapeles.\n\n' : '') +
        'Después de ingresar, cree los usuarios del personal desde la pantalla Usuarios.',
      buttons: ['Copiar contraseña', 'Ya la anoté'],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
    });
    if (response === 1) return;
    clipboard.writeText(password);
    copied = true;
  }
};

const readConfig = () =>
  Object.fromEntries(
    fs
      .readFileSync(paths.config, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^\s*[A-Z_][A-Z0-9_]*\s*=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
  );

/** Cambia (o agrega) una clave del archivo de configuración conservando el resto. */
const writeConfigValue = (key, value) => {
  const text = fs.readFileSync(paths.config, 'utf8');
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  fs.writeFileSync(paths.config, pattern.test(text) ? text.replace(pattern, `${key}=${value}`) : `${text}\r\n${key}=${value}\r\n`);
};

const settings = () => {
  const cfg = readConfig();
  return { cfg, port: Number(cfg.PORT) || 3000, shared: String(cfg.COMPARTIR_EN_RED).toLowerCase() === 'true' };
};

const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);

// ------------------------------------------------------------------ servidor
let server = null;
let serverExit = null;
let stoppingServer = false;

const isUp = async (port) => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health/ready`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
};

const portIsFree = (port, host) =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });

const lastLog = (lines = 15) => {
  try {
    return fs.readFileSync(paths.log, 'utf8').split(/\r?\n/).filter(Boolean).slice(-lines).join('\n');
  } catch {
    return '(sin registros)';
  }
};

const startServer = async (extraEnv = {}) => {
  const { cfg, port, shared } = settings();
  const host = shared ? '0.0.0.0' : '127.0.0.1';

  if (!(await portIsFree(port, host))) {
    const detail = (await isUp(port))
      ? `Ya hay otra copia de ${APP_NAME} abierta en el puerto ${port} (por ejemplo, la iniciada con iniciar.bat). Ciérrela con detener.bat y vuelva a abrir esta aplicación.`
      : `El puerto ${port} está ocupado por otro programa. Cámbielo (PORT) en:\n${paths.config}`;
    throw new Error(detail);
  }

  if (fs.existsSync(paths.log)) fs.renameSync(paths.log, `${paths.log}.anterior`);
  const logStream = fs.createWriteStream(paths.log, { flags: 'a' });

  serverExit = null;
  server = utilityProcess.fork(path.join(serverDir, 'backend', 'dist', 'main.js'), [], {
    cwd: dataRoot,
    serviceName: `${APP_NAME} servidor`,
    stdio: 'pipe',
    env: {
      ...process.env,
      ...cfg,
      ...extraEnv,
      NODE_ENV: 'production',
      HOST: host,
      PORT: String(port),
      DB_PATH: paths.db,
      STORAGE_LOCAL_PATH: paths.storage,
      MIGRATIONS_DIR: path.join(serverDir, 'migraciones'),
      FRONTEND_DIST: path.join(serverDir, 'interfaz'),
    },
  });
  server.stdout?.pipe(logStream);
  server.stderr?.pipe(logStream);
  server.once('exit', (code) => {
    serverExit = code ?? 1;
    server = null;
    if (!stoppingServer && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(APP_NAME, `El servidor se detuvo inesperadamente.\n\n${lastLog()}`);
      app.quit();
    }
  });

  for (let i = 0; i < 120; i++) {
    if (serverExit !== null) throw new Error(`El servidor no pudo iniciar. Últimos mensajes:\n\n${lastLog()}`);
    if (await isUp(port)) return `http://localhost:${port}`;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`El servidor no respondió a tiempo. Revise el registro:\n${paths.log}`);
};

const stopServer = () =>
  new Promise((resolve) => {
    if (!server) return resolve();
    stoppingServer = true;
    server.once('exit', () => {
      stoppingServer = false;
      resolve();
    });
    server.kill();
  });

// ------------------------------------------------------------------ ventana
let mainWindow = null;
let quitting = false;

const LOADING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(
  `<html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
   font-family:Segoe UI,sans-serif;background:#f5f6f8;color:#333"><div style="text-align:center">
   <h2 style="margin:0 0 8px">${APP_NAME}</h2><p style="margin:0">Iniciando…</p></div></body></html>`,
)}`;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: APP_NAME,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(LOADING_HTML);

  // PDF y fotos (blob:) y rutas internas se abren en ventanas de la app; enlaces externos en el navegador.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const internal = url === 'about:blank' || url.startsWith('blob:') || url.startsWith('http://localhost:');
    if (internal) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    if (/^https?:|^mailto:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (quitting || !settings().shared) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Cerrar', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: APP_NAME,
      message: 'La aplicación está compartida en la red.',
      detail: 'Si la cierra, los demás equipos perderán el acceso hasta que la vuelva a abrir.',
    });
    if (choice === 1) event.preventDefault();
  });
  mainWindow.on('closed', () => (mainWindow = null));
};

// ------------------------------------------------------------------ red local
const showNetworkInfo = () => {
  const { port, shared } = settings();
  const ips = lanAddresses();
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Acceso desde otros equipos',
    message: shared ? 'La aplicación está compartida en la red local.' : 'La aplicación NO está compartida en la red.',
    detail: shared
      ? `Los demás equipos de la misma red pueden entrar desde el navegador con:\n\n${
          ips.map((ip) => `   http://${ip}:${port}`).join('\n') || '   (no se encontró una red conectada)'
        }\n\nEste equipo debe permanecer encendido y con ${APP_NAME} abierto.`
      : 'Active "Red > Compartir en la red local" para que otros equipos puedan entrar.',
  });
};

const toggleSharing = async (menuItem) => {
  const enable = menuItem.checked;
  if (enable) {
    const ok = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Compartir', 'Cancelar'],
      defaultId: 0,
      cancelId: 1,
      title: APP_NAME,
      message: '¿Compartir la aplicación con otros equipos de la red?',
      detail:
        'Cualquier equipo conectado a esta red podrá abrir la pantalla de ingreso (necesitará usuario y contraseña).\n' +
        'Úselo sólo en la red privada del local, nunca en una red Wi-Fi pública.\n\n' +
        'Si Windows pregunta por el Firewall, permita el acceso en "Redes privadas".',
    });
    if (ok !== 0) {
      menuItem.checked = false;
      return;
    }
  }
  writeConfigValue('COMPARTIR_EN_RED', enable ? 'true' : 'false');
  await restartServer();
  if (enable) showNetworkInfo();
};

const restartServer = async () => {
  mainWindow?.loadURL(LOADING_HTML);
  await stopServer();
  try {
    const url = await startServer();
    await mainWindow?.loadURL(url);
  } catch (error) {
    dialog.showErrorBox(APP_NAME, error.message);
    app.quit();
  }
};

// ------------------------------------------------------------------ menú
const buildMenu = () => {
  const { shared } = settings();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Archivo',
        submenu: [
          { label: 'Abrir carpeta de datos', click: () => shell.openPath(dataRoot) },
          { label: 'Editar configuración', click: () => shell.openPath(paths.config) },
          { label: 'Ver registro del servidor', click: () => shell.openPath(paths.log) },
          { label: 'Reiniciar servidor', click: () => restartServer() },
          { type: 'separator' },
          { label: 'Salir', role: 'quit' },
        ],
      },
      {
        label: 'Ver',
        submenu: [
          { role: 'reload', label: 'Recargar' },
          { type: 'separator' },
          { role: 'zoomIn', label: 'Acercar' },
          { role: 'zoomOut', label: 'Alejar' },
          { role: 'resetZoom', label: 'Tamaño normal' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Pantalla completa' },
          { role: 'toggleDevTools', label: 'Herramientas de desarrollo', visible: !app.isPackaged },
        ],
      },
      {
        label: 'Red',
        submenu: [
          { label: 'Compartir en la red local', type: 'checkbox', checked: shared, click: (item) => toggleSharing(item) },
          { label: 'Direcciones para otros equipos…', click: () => showNetworkInfo() },
        ],
      },
      {
        label: 'Ayuda',
        submenu: [
          {
            label: `Acerca de ${APP_NAME}`,
            click: () =>
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: APP_NAME,
                message: `${APP_NAME} ${app.getVersion()}`,
                detail: `Gestión y seguimiento de reparación de equipos electrónicos.\n\nDatos: ${dataRoot}`,
              }),
          },
        ],
      },
    ]),
  );
};

// ------------------------------------------------------------------ ciclo de vida
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    ensureConfig();
    buildMenu();
    createWindow();
    // ADMIN_EMAIL: configuraciones creadas antes del cambio a nombre de usuario.
    const { ADMIN_USER, ADMIN_EMAIL } = readConfig();
    const adminUser = ADMIN_USER ?? ADMIN_EMAIL;
    const adminPassword = prepareAdminPassword();
    try {
      // La contraseña viaja al servidor sólo por variable de entorno (no queda en disco en texto plano).
      const url = await startServer(adminPassword ? { ADMIN_PASSWORD: adminPassword } : {});
      await mainWindow?.loadURL(url);
      if (adminPassword) {
        // Se muestra mientras siga sirviendo para entrar; la copia cifrada se borra tras confirmar.
        if (await credentialsWork(settings().port, adminUser, adminPassword)) {
          await showInitialCredentials(adminUser, adminPassword);
        }
        clearPendingAdmin();
      }
    } catch (error) {
      dialog.showErrorBox(APP_NAME, error.message);
      app.quit();
    }
  });

  app.on('before-quit', () => (quitting = true));
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', (event) => {
    if (!server) return;
    event.preventDefault();
    void stopServer().then(() => app.quit());
  });
}
