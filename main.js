const { app, BrowserWindow, ipcMain, protocol, nativeTheme } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { scanApps } = require('./app-host/registry');
const { openApp } = require('./app-host/runtime');
const services = require('./app-host/services');
nativeTheme.themeSource = 'dark';
protocol.registerSchemesAsPrivileged(['aether-app','aether-media'].map(scheme=>({scheme, privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}})));
const appsRoot = path.join(__dirname, 'apps');
let registryPromise;
function isLauncher(event) { return event.senderFrame === event.sender.mainFrame && event.sender.getURL() === pathToFileURL(path.join(__dirname,'index.html')).href; }
ipcMain.handle('set-theme', (event, theme) => {
  if (!isLauncher(event) || !['dark','light'].includes(theme)) return false;
  nativeTheme.themeSource = theme;
  services.updateTheme(theme);
  return true;
});
ipcMain.handle('apps-list', async event => {
  if (!isLauncher(event)) throw new Error('Invalid caller');
  const {apps,errors} = await (registryPromise=scanApps(appsRoot));
  return {apps:apps.map(({folder,entry,...metadata}) => metadata),errors};
});
ipcMain.handle('apps-open', async (event,id) => {
  if (!isLauncher(event)) return {error:'Invalid caller'};
  try {
    const {apps} = await (registryPromise||=scanApps(appsRoot));
    const application = apps.find(item => item.id === id);
    if (!application) throw new Error('应用不存在或配置无效，请检查 apps 目录。');
    await openApp(application, BrowserWindow.fromWebContents(event.sender));
    return {};
  } catch (error) { return {error:error.message}; }
});

async function createWindow() {
  const window = new BrowserWindow({
    width: 1470,
    height: 950,
    minWidth: 1000,
    minHeight: 720,
    frame: false,
    show: false,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  services.bind(window.webContents,'launcher');
  window.on('close',()=>{window.isClosing=true;for(const child of BrowserWindow.getAllWindows())if(child!==window)child.close();});
  window.once('ready-to-show',()=>{if(!window.isDestroyed()){window.show();window.webContents.backgroundThrottling=true;}});
  await window.loadFile(path.join(__dirname,'index.html'));
}

ipcMain.on('window-control', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (action === 'close') window.close();
  if (action === 'minimize') window.minimize();
  if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
});

app.whenReady().then(()=>{services.install();createWindow();});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
