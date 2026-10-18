const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('focoDesktop', {
  lock: (on) => ipcRenderer.send('foco-lock', !!on),
  onLeave: (cb) => { ipcRenderer.on('foco-left', () => cb()); }
});
