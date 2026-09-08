const {app,BrowserWindow,webContents,desktopCapturer,screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const folder=path.join(__dirname,'../output/module-check-visual-'+Date.now());fs.mkdirSync(folder,{recursive:true});
app.setPath('userData',path.join(folder,'profile'));
require('../main');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
  const hub=BrowserWindow.getAllWindows()[0];await delay(700);
  const display=screen.getPrimaryDisplay(),bounds={x:display.workArea.x+10,y:display.workArea.y+10,width:Math.min(1400,display.workArea.width-20),height:Math.min(950,display.workArea.height-20)};
  for(const slug of ['2048','planner','savings','tetris','pomodoro','minesweeper','snake','sudoku','notepad','habits','currency','breakout']){
    const result=await hub.webContents.executeJavaScript(`launcher.openApp('local-${slug}')`);assert.ok(!result.error,result.error);
    const host=BrowserWindow.getAllWindows().find(w=>w!==hub);host.setBounds(bounds);host.setAlwaysOnTop(true);host.show();host.focus();await delay(500);
    const view=webContents.getAllWebContents().find(c=>c.getURL().startsWith('aether-app://'+(slug==='2048'?'app-2048':slug)+'/'));
    const size=await view.executeJavaScript('({width:innerWidth,height:innerHeight,body:document.body.innerText})');assert.ok(size.width>500&&size.height>300,JSON.stringify(size));
    const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)}});
    const source=sources.find(s=>s.display_id===String(display.id))||sources[0],pixels=source.thumbnail.getSize(),scale=pixels.width/display.size.width;
    fs.writeFileSync(path.join(folder,slug+'.png'),source.thumbnail.crop({x:Math.round((bounds.x-display.bounds.x)*scale),y:Math.round((bounds.y-display.bounds.y)*scale),width:Math.round(bounds.width*scale),height:Math.round(bounds.height*scale)}).toPNG());
    host.close();console.log('Captured '+slug+' '+size.width+'x'+size.height);
  }
  console.log(folder);app.exit(0);
}catch(error){console.error(error);app.exit(1);}});
