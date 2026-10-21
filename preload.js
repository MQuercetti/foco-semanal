const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('focoDesktop', {
  lock: (on) => ipcRenderer.send('foco-lock', !!on),
  onLeave: (cb) => { ipcRenderer.on('foco-left', () => cb()); },
  win: (cmd) => { if (['min', 'max', 'close', 'state'].indexOf(cmd) >= 0) ipcRenderer.send('foco-win', cmd); },
  onMax: (cb) => { ipcRenderer.on('foco-max', (e, v) => cb(!!v)); }
});
