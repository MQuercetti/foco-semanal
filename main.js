const { app, BrowserWindow, Menu, shell, protocol, net, session, ipcMain, screen } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_DIR = path.join(__dirname, 'app');
const START_URL = 'app://foco/index.html';
const CSP = [
  "default-src 'self' app:",
  "script-src 'self' app: 'unsafe-inline'",
  "style-src 'self' app: 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src 'self' app: data: blob:",
  "frame-src blob:",
  "media-src 'self' blob:",
  "connect-src 'self' app: https: wss://*.supabase.co http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'none'"
].join('; ');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
let locked = false;
/* Modo estudio: pantalla completa, siempre al frente, sin cerrar ni minimizar. Windows no deja bloquear Alt+Tab ni la tecla Windows, por eso
   cada salida de la ventana se cuenta y la ventana vuelve al frente. Ctrl+Mayús+Alt+L libera el bloqueo si algo sale mal. */
function setLock(on) {
  locked = !!on;
  if (!win || win.isDestroyed()) return;
  if (locked) { win.setMinimizable(false); win.setKiosk(true); win.setAlwaysOnTop(true, 'screen-saver'); win.focus(); }
  else { win.setAlwaysOnTop(false); win.setKiosk(false); win.setMinimizable(true); if (!win.isMaximized()) win.maximize(); }
}
ipcMain.on('foco-lock', (e, on) => { if (win && !win.isDestroyed() && e.sender === win.webContents) setLock(on); });
ipcMain.handle('foco-version', () => app.getVersion());
ipcMain.on('foco-win', (e, cmd) => {
  if (!win || win.isDestroyed() || e.sender !== win.webContents) return;
  if (cmd === 'state') { win.webContents.send('foco-max', win.isMaximized()); return; }
  if (locked) return;
  if (cmd === 'min') win.minimize();
  else if (cmd === 'max') { if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
  else if (cmd === 'close') win.close();
});
function isInternal(url) { return url.startsWith('app://foco/'); }
function openExternal(url) { if (/^https?:\/\//i.test(url)) shell.openExternal(url); }

function createWindow() {
  const wa = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: wa.width, height: wa.height, minWidth: 360, minHeight: 520, show: false, frame: false,
    backgroundColor: '#f5f6f8', title: 'Foco Semanal', icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  const sendMax = () => { if (win && !win.isDestroyed()) win.webContents.send('foco-max', win.isMaximized()); };
  win.on('maximize', sendMax); win.on('unmaximize', sendMax);
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!isInternal(url)) { e.preventDefault(); openExternal(url); } });
  win.on('close', (e) => { if (locked) e.preventDefault(); });
  win.on('minimize', () => { if (locked && win) win.restore(); });
  win.on('blur', () => {
    if (!locked || !win) return;
    win.webContents.send('foco-left');
    setTimeout(() => { if (locked && win && !win.isDestroyed()) { win.show(); win.focus(); } }, 150);
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control && input.shift && input.alt && String(input.key).toLowerCase() === 'l') { setLock(false); return; }
    if (!locked) return;
    const k = String(input.key).toLowerCase();
    if (k === 'f11' || k === 'f5' || (input.control && ['w', 'r', 'n', 't'].includes(k)) || (input.alt && k === 'f4')) e.preventDefault();
  });
  win.webContents.on('render-process-gone', () => setLock(false));
  win.webContents.on('did-finish-load', () => { if (locked) setLock(true); sendMax(); });
  win.on('closed', () => { win = null; locked = false; });
  win.loadURL(START_URL);
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR + path.sep)) return new Response('No encontrado', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const h = Object.assign({}, details.responseHeaders);
    if (details.url.startsWith('app://')) h['Content-Security-Policy'] = [CSP];
    cb({ responseHeaders: h });
  });
  createWindow();
  if (app.isPackaged) {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = true;
      autoUpdater.checkForUpdatesAndNotify().catch(() => { /* sin conexión o sin versión nueva */ });
    } catch (e) { /* actualización automática no disponible */ }
  }
});

app.on('before-quit', () => { locked = false; });
app.on('window-all-closed', () => { app.quit(); });
