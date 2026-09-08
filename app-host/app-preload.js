const {contextBridge,ipcRenderer}=require('electron');
function sync(channel,value){const result=ipcRenderer.sendSync(channel,value);if(result.error)throw new Error(result.error);return result.value;}
contextBridge.exposeInMainWorld('appStore',{
  theme:()=>ipcRenderer.sendSync('app-theme'),
  onTheme:callback=>ipcRenderer.on('theme-updated',(_event,theme)=>callback(theme)),
  read:()=>sync('save-read'),
  write:value=>sync('save-write',value),
  rates:()=>ipcRenderer.invoke('online-data','rates')
});
