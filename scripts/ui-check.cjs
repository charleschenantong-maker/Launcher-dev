const start=performance.now();
const {app,BrowserWindow,webContents,desktopCapturer,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const folder=path.join(__dirname,'../output/module-check-ui-'+Date.now());fs.mkdirSync(folder,{recursive:true});app.setPath('userData',path.join(folder,'profile'));
app.on('browser-window-created',(_e,w)=>w.once('show',()=>console.log('SHOW '+Math.round(performance.now()-start)+'ms '+w.webContents.getURL())));
require('../main');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function capture(w,name){w.setAlwaysOnTop(true);w.focus();await delay(150);const d=screen.getDisplayMatching(w.getBounds()),sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(d.size.width*d.scaleFactor),height:Math.round(d.size.height*d.scaleFactor)}}),src=sources.find(s=>s.display_id===String(d.id)),b=w.getBounds(),k=src.thumbnail.getSize().width/d.size.width;fs.writeFileSync(path.join(folder,name+'.png'),src.thumbnail.crop({x:Math.round((b.x-d.bounds.x)*k),y:Math.round((b.y-d.bounds.y)*k),width:Math.round(b.width*k),height:Math.round(b.height*k)}).toPNG());}
app.whenReady().then(async()=>{try{
 const hub=BrowserWindow.getAllWindows()[0];if(!hub.isVisible())await new Promise(r=>hub.once('show',r));
 for(const [width,height] of [[1000,720],[1250,850]]){
 hub.setBounds({x:20,y:20,width,height});await delay(100);
 for(const page of ['Settings','Stats']){await hub.webContents.executeJavaScript(`showHubPage('${page}')`);const box=await hub.webContents.executeJavaScript(`(()=>{const d=dialog,e=document.querySelector('#dialog-extra'),r=d.getBoundingClientRect();return {width:d.clientWidth,scroll:d.scrollWidth,extra:e.clientWidth,extraScroll:e.scrollWidth,top:r.top,bottom:r.bottom,height:innerHeight}})()`);assert.ok(box.scroll<=box.width+1&&box.extraScroll<=box.extra+1&&box.top>=0&&box.bottom<=box.height,JSON.stringify(box));await capture(hub,page+'-'+width);await hub.webContents.executeJavaScript('dialog.close()');}
 await hub.webContents.executeJavaScript(`document.querySelector('[data-view="grid"]').click()`);
 console.log(await hub.webContents.executeJavaScript(`Array.from(document.querySelectorAll('#explore .app-row')).map(row=>({row:row.getBoundingClientRect().toJSON(),button:row.querySelector('.open-app').getBoundingClientRect().toJSON(),copy:row.querySelector('.app-copy').getBoundingClientRect().toJSON()}))`));assert.equal(await hub.webContents.executeJavaScript(`Array.from(document.querySelectorAll('#explore .app-row')).every(row=>{const r=row.getBoundingClientRect(),b=row.querySelector('.open-app').getBoundingClientRect(),copy=row.querySelector('.app-copy').getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.bottom<=r.bottom&&b.top>=copy.bottom})`),true);await capture(hub,'grid-'+width);
 }
 for(const slug of ['sudoku','chess','reaction','wordle','pacman']){const t=performance.now(),result=await hub.webContents.executeJavaScript(`launcher.openApp('local-${slug}')`);assert.ok(!result.error,result.error);console.log('OPEN '+slug+' '+Math.round(performance.now()-t)+'ms');const host=BrowserWindow.getAllWindows().find(w=>w!==hub);assert.ok(host.isVisible());host.setBounds({x:20,y:20,width:1100,height:800});const content=webContents.getAllWebContents().find(c=>c.getURL().startsWith('aether-app://'+slug+'/'));
 if(slug==='chess'){await content.executeJavaScript(`for(const [a,b] of [['e2','e4'],['d7','d5'],['e4','d5']]){document.querySelector('[data-square="'+a+'"]').click();document.querySelector('[data-square="'+b+'"]').click();}`);assert.match(await content.executeJavaScript(`document.querySelector('#material').innerText`),/1 pts/);await content.executeJavaScript(`for(let i=0;i<3;i++)document.querySelector('#undo').click();for(const [a,b] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]){document.querySelector('[data-square="'+a+'"]').click();document.querySelector('[data-square="'+b+'"]').click();}`);assert.match(await content.executeJavaScript(`document.querySelector('#outcome').innerText`),/Black wins — Checkmate/);}
 await capture(host,slug+'-dark');await hub.webContents.executeJavaScript(`document.querySelector('[data-theme-choice="light"]').click()`);await capture(host,slug+'-light');await hub.webContents.executeJavaScript(`document.querySelector('[data-theme-choice="dark"]').click()`);host.close();}
 console.log('PASS: visible app launch, chess captures/checkmate, dialog and grid geometry. '+folder);app.exit(0);
}catch(e){console.error(e);app.exit(1);}});


