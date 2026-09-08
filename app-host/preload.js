const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('host', {
  theme:()=>ipcRenderer.sendSync('app-theme'),
  onTheme:callback=>ipcRenderer.on('theme-updated',(_event,theme)=>callback(theme)),
  control: action => { if (['close','minimize','maximize'].includes(action)) ipcRenderer.send('window-control',action); }
});
