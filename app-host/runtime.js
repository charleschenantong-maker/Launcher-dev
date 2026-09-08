const { BrowserWindow, WebContentsView, session, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { localFile } = require('./registry');
const services = require('./services');
const windows = new Map();
const sessions = new Map();

async function openApp(application, parent) {
  const hostname = /^(?:\d+|0x[0-9a-f]+)$/i.test(application.slug) ? 'app-'+application.slug : application.slug;
  const existing = windows.get(application.id);
  if (existing && !existing.isDestroyed()) { if(existing.launchReady){if(existing.isMinimized())existing.restore();existing.show();existing.focus();}return; }
  let context = sessions.get(application.id);
  if (!context) {
    const isolated = session.fromPartition(`persist:local-app-${application.slug}`);
    context = { session: isolated, application, hostname };
    isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    isolated.setPermissionCheckHandler(() => false);
    isolated.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url);
      callback({ cancel: !((url.protocol === 'aether-app:' && url.hostname === context.hostname) || ['data:', 'blob:'].includes(url.protocol)) });
    });
    isolated.protocol.handle('aether-app', async request => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== context.hostname || !['GET','HEAD'].includes(request.method)) return new Response('Forbidden', { status:403 });
        const relative = decodeURIComponent(url.pathname).slice(1) || context.application.entry;
        const file = await localFile(context.application.folder, relative.endsWith('/') ? relative + 'index.html' : relative);
        const response = await net.fetch(pathToFileURL(file).href);
        response.headers.set('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'");
        return response;
      } catch { return new Response('Local file not found', { status:404 }); }
    });
    sessions.set(application.id, context);
  }
  context.application = application;
  const window = new BrowserWindow({ width:1400, height:950, minWidth:800, minHeight:600, frame:false, show:false, backgroundColor:'#00000000', backgroundMaterial:'acrylic', webPreferences:{ contextIsolation:true, nodeIntegration:false, sandbox:true, backgroundThrottling:false, preload:path.join(__dirname,'preload.js') } });
  services.bind(window.webContents,'host-'+application.slug);
  windows.set(application.id, window);
  const view = new WebContentsView({ webPreferences:{ session:context.session, contextIsolation:true, nodeIntegration:false, sandbox:true, backgroundThrottling:false, preload:path.join(__dirname,'app-preload.js') } });
  view.setBackgroundColor('#00000000');
  services.bind(view.webContents,'app-'+application.slug);
  services.record(application.slug);
  let lastTick=Date.now(),tracking=window.isFocused();
  const flushUsage=()=>{const now=Date.now();if(tracking&&now>lastTick){try{services.record(application.slug,(now-lastTick)/1000);}catch(error){console.error('Cannot save usage:',error.message);}}lastTick=now;};
  window.on('focus',()=>{lastTick=Date.now();tracking=true;});
  window.on('blur',()=>{flushUsage();tracking=false;});
  const usageTimer=setInterval(flushUsage,10000);
  window.once('close',flushUsage);
  window.once('closed',()=>clearInterval(usageTimer));
  window.contentView.addChildView(view);
  const resize = () => { const {width,height} = window.getContentBounds(); view.setBounds({x:0,y:44,width,height:Math.max(0,height-44)}); };
  window.on('resize', resize);
  window.on('closed', () => { windows.delete(application.id); if (!view.webContents.isDestroyed()) view.webContents.close(); if (!parent.isDestroyed()&&!parent.isClosing) { parent.show(); parent.focus(); } });
  for (const contents of [window.webContents, view.webContents]) contents.setWindowOpenHandler(() => ({action:'deny'}));
  window.webContents.on('will-navigate', event => event.preventDefault());
  view.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`aether-app://${hostname}/`)) event.preventDefault(); });
  resize();
  try {
    await Promise.all([
      window.loadFile(path.join(__dirname,'index.html'), {query:{name:application.name,network:application.slug==='currency'?'rates':''}}),
      view.webContents.loadURL(`aether-app://${hostname}/${application.entry.split('/').map(encodeURIComponent).join('/')}`)
    ]);
    window.launchReady=true;window.show();window.focus();view.webContents.focus();
    window.webContents.backgroundThrottling=true;view.webContents.backgroundThrottling=true;
  } catch (error) { window.close(); throw error; }
}
module.exports = { openApp };
