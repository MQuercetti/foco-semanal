const { app, BrowserWindow, Menu, shell, protocol, net, session } = require('electron');
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
  "media-src 'self' blob:",
  "connect-src 'self' app: https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
  "object-src 'none'",
  "base-uri 'none'"
].join('; ');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
function isInternal(url) { return url.startsWith('app://foco/'); }
function openExternal(url) { if (/^https?:\/\//i.test(url)) shell.openExternal(url); }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360, minHeight: 520, show: false,
    backgroundColor: '#f5f6f8', title: 'Foco Semanal', icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!isInternal(url)) { e.preventDefault(); openExternal(url); } });
  win.on('closed', () => { win = null; });
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

app.on('window-all-closed', () => { app.quit(); });
