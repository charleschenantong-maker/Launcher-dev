const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('host', { control: action => { if (['close','minimize','maximize'].includes(action)) ipcRenderer.send('window-control',action); } });
