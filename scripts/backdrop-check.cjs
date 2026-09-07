const {app,BrowserWindow,desktopCapturer,screen} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
require('../main');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  try {
    const hub=BrowserWindow.getAllWindows()[0];
    const display=screen.getPrimaryDisplay();
    const bounds={x:display.workArea.x+20,y:display.workArea.y+20,width:Math.min(1470,display.workArea.width-40),height:Math.min(950,display.workArea.height-40)};
    const backdrop=new BrowserWindow({...bounds,frame:false,backgroundColor:'#e82c40',webPreferences:{sandbox:true}});
    await backdrop.loadURL('data:text/html,<body style="margin:0;background:linear-gradient(90deg,%23ff2347,%23fca94d);height:100vh"></body>');
    hub.setBounds(bounds);hub.setAlwaysOnTop(true);hub.show();hub.focus();
    await delay(1500);
    async function capture(name){
      const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)}});
      const source=sources.find(item=>item.display_id===String(display.id))||sources[0];
      const size=source.thumbnail.getSize(), sx=size.width/display.size.width,sy=size.height/display.size.height;
      const image=source.thumbnail.crop({x:Math.round((bounds.x-display.bounds.x)*sx),y:Math.round((bounds.y-display.bounds.y)*sy),width:Math.round(bounds.width*sx),height:Math.round(bounds.height*sy)});
      fs.writeFileSync(path.join(__dirname,'../output',name),image.toPNG());
    }
    await capture('acrylic-warm.png');
    await backdrop.webContents.executeJavaScript('document.body.style.background="linear-gradient(90deg,#1456ee,#11d9c1)"');
    hub.focus();await delay(1500);await capture('acrylic-cool.png');
    await hub.webContents.executeJavaScript('document.querySelector("[data-theme-choice=light]").click()');
    hub.focus();await delay(1500);await capture('acrylic-light.png');
    await hub.webContents.executeJavaScript('document.querySelector("[data-theme-choice=dark]").click()');
    console.log('Captured system-composited window over warm and cool backdrops.');
    backdrop.close();app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
