const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  listApps: () => ipcRenderer.invoke('apps-list'),
  openApp: id => ipcRenderer.invoke('apps-open',id),
  controlWindow: (action) => {
    if (['close', 'minimize', 'maximize'].includes(action)) ipcRenderer.send('window-control', action);
  }
});
