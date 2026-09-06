const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { scanApps } = require('./app-host/registry');
const { openApp } = require('./app-host/runtime');
protocol.registerSchemesAsPrivileged([{scheme:'aether-app', privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const appsRoot = path.join(__dirname, 'apps');
function isLauncher(event) { return event.senderFrame === event.sender.mainFrame && event.sender.getURL() === pathToFileURL(path.join(__dirname,'index.html')).href; }
ipcMain.handle('apps-list', async event => {
  if (!isLauncher(event)) throw new Error('Invalid caller');
  const {apps,errors} = await scanApps(appsRoot);
  return {apps:apps.map(({folder,entry,...metadata}) => metadata),errors};
});
ipcMain.handle('apps-open', async (event,id) => {
  if (!isLauncher(event)) return {error:'Invalid caller'};
  try {
    const {apps} = await scanApps(appsRoot);
    const application = apps.find(item => item.id === id);
    if (!application) throw new Error('应用不存在或配置无效，请检查 apps 目录。');
    await openApp(application, BrowserWindow.fromWebContents(event.sender));
    return {};
  } catch (error) { return {error:error.message}; }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1000,
    minHeight: 720,
    frame: false,
    backgroundColor: '#171d2b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  window.loadFile(path.join(__dirname,'index.html'));
}

ipcMain.on('window-control', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (action === 'close') window.close();
  if (action === 'minimize') window.minimize();
  if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
