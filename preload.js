const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  controlWindow: (action) => {
    if (['close', 'minimize', 'maximize'].includes(action)) ipcRenderer.send('window-control', action);
  }
});
