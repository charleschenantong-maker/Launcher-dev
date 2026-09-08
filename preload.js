const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  read: () => {const r=ipcRenderer.sendSync('save-read');if(r.error)throw new Error(r.error);return r.value;},
  write: value => {const r=ipcRenderer.sendSync('save-write',value);if(r.error)throw new Error(r.error);},
  summary: () => ipcRenderer.invoke('hub-summary'),
  weather: () => ipcRenderer.invoke('online-data','weather'),
  pickMusic: () => ipcRenderer.invoke('music-pick'),
  listMusic: () => ipcRenderer.invoke('music-list'),
  setTheme: theme => ipcRenderer.invoke('set-theme',theme),
  listApps: () => ipcRenderer.invoke('apps-list'),
  openApp: id => ipcRenderer.invoke('apps-open',id),
  controlWindow: (action) => {
    if (['close', 'minimize', 'maximize'].includes(action)) ipcRenderer.send('window-control', action);
  }
});
