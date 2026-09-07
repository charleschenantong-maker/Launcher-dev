const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  setTheme: theme => ipcRenderer.invoke('set-theme',theme),
  listApps: () => ipcRenderer.invoke('apps-list'),
  openApp: id => ipcRenderer.invoke('apps-open',id),
  controlWindow: (action) => {
    if (['close', 'minimize', 'maximize'].includes(action)) ipcRenderer.send('window-control', action);
  }
});
