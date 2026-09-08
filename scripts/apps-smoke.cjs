const {app,BrowserWindow,webContents} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {scanApps,localFile} = require('../app-host/registry');
const root = path.join(__dirname,'..','apps');
const slug = `smoke-${process.pid}`;
app.setPath('userData',path.join(__dirname,'../output/module-check-registry-'+process.pid));
const folder = path.join(root,slug);
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
async function until(read) { for(let i=0;i<80;i++){ const result=await read(); if(result)return result; await delay(100); } throw new Error('Timed out'); }
require('../main');
app.whenReady().then(async () => {
  let code=0;
  try {
    await fs.mkdir(path.join(folder,'project'),{recursive:true});
    await fs.writeFile(path.join(folder,'app.json'),JSON.stringify({name:'Offline <test>',entry:'project/index.html',category:'Tools'}));
    await fs.writeFile(path.join(folder,'project','index.html'),'<title>Offline check</title><button id="count">0</button><script type="module" src="./main.js"></script>');
    await fs.writeFile(path.join(folder,'project','main.js'), 'window.ready = (await (await fetch("./data.json")).json()).ok; document.querySelector("button").onclick = e => e.target.textContent = Number(e.target.textContent)+1;');
    await fs.writeFile(path.join(folder,'project','data.json'),'{"ok":true}');
    await assert.rejects(localFile(folder,'../../main.js'));
    await fs.writeFile(path.join(folder,'bad.json'),'{}');
    assert.ok((await scanApps(root)).apps.some(a=>a.slug===slug));
    const hub=BrowserWindow.getAllWindows()[0];
    await until(()=>hub.webContents.executeJavaScript('typeof refreshApps === "function"').catch(()=>false));
    await hub.webContents.executeJavaScript('refreshApps()');
    await until(()=>hub.webContents.executeJavaScript(`!!document.querySelector('[data-app="local-${slug}"]')`));
    await hub.webContents.executeJavaScript(`document.querySelector('[data-app="local-${slug}"]').click()`);
    const content=await until(()=>webContents.getAllWebContents().find(c=>c.getURL().startsWith(`aether-app://${slug}/`)));
    await until(()=>content.executeJavaScript('window.ready').catch(()=>false));
    assert.equal(await content.executeJavaScript('typeof window.launcher'), 'undefined');
    assert.equal(await content.executeJavaScript('typeof require'), 'undefined');
    assert.equal(await content.executeJavaScript('fetch("https://example.com").then(()=>false,()=>true)'),true);
    assert.equal(await content.executeJavaScript('fetch("/../app.json").then(r=>r.status)'),200); // URL stays inside the same app root.
    assert.equal(await content.executeJavaScript('fetch("/%2e%2e%2fmain.js").then(r=>r.status)'),404);
    await content.executeJavaScript('document.querySelector("button").click()');
    assert.equal(await content.executeJavaScript('document.querySelector("button").textContent'),'1');
    const host=BrowserWindow.getAllWindows().find(w=>w!==hub);
    await host.webContents.executeJavaScript('document.querySelector("#back").click()');
    await until(()=>host.isDestroyed());
    assert.ok(!hub.isDestroyed());
    console.log('PASS: discovery, safe metadata, local modules/fetch, offline enforcement, path boundary, isolated app, interaction, return');
  } catch(error) {console.error(error);code=1;}
  finally {
    for(const name of ['project/index.html','project/main.js','project/data.json','app.json','bad.json']) await fs.unlink(path.join(folder,name)).catch(()=>{});
    await fs.rmdir(path.join(folder,'project')).catch(()=>{});
    await fs.rmdir(folder).catch(()=>{});
    app.exit(code);
  }
});
