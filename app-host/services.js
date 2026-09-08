const { app, ipcMain, dialog, protocol, net, nativeTheme, webContents } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const crypto = require('node:crypto');
const clients = new Map();
const cache = new Map();
function savePath(name) { const dir=path.join(app.getPath('userData'),'saves');fs.mkdirSync(dir,{recursive:true});return path.join(dir,name+'.json'); }
function read(name) {
  if(cache.has(name)) return cache.get(name);
  const file=savePath(name);let value=null;
  if(fs.existsSync(file)) { try {value=JSON.parse(fs.readFileSync(file,'utf8'));} catch(error) {if(!fs.existsSync(file+'.bak'))throw error;value=JSON.parse(fs.readFileSync(file+'.bak','utf8'));} }
  cache.set(name,value);return value;
}
function write(name,value) {
  const text=JSON.stringify(value);if(!text||Buffer.byteLength(text)>4*1024*1024)throw new Error('Save exceeds 4 MB');
  const file=savePath(name),temp=file+'.tmp';
  const fd=fs.openSync(temp,'w');try {fs.writeFileSync(fd,text);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(cache.has(name)&&cache.get(name)!==null)fs.writeFileSync(file+'.bak',JSON.stringify(cache.get(name)));
  fs.renameSync(temp,file);cache.set(name,value);
}
function bind(contents,name) { clients.set(contents.id,name);contents.once('destroyed',()=>clients.delete(contents.id)); }
function caller(event) { if(event.senderFrame!==event.sender.mainFrame)throw new Error('Invalid frame');const name=clients.get(event.sender.id);if(!name)throw new Error('Invalid caller');return name; }
function install() {
  ipcMain.on('app-theme',event=>{try{caller(event);event.returnValue=nativeTheme.themeSource==='light'?'light':'dark';}catch{event.returnValue='dark';}});
  ipcMain.on('save-read',(event)=>{try{event.returnValue={value:read(caller(event))};}catch(error){event.returnValue={error:error.message};}});
  ipcMain.on('save-write',(event,value)=>{try{write(caller(event),value);event.returnValue={ok:true};}catch(error){event.returnValue={error:error.message};}});
  ipcMain.handle('hub-summary',event=>{if(caller(event)!=='launcher')throw new Error('Invalid caller');return {usage:read('usage')||{},planner:read('app-planner'),habits:read('app-habits'),savings:read('app-savings'),pomodoro:read('app-pomodoro'),directory:path.dirname(savePath('launcher'))};});
  ipcMain.handle('online-data',async(event,kind)=>{
    const name=caller(event);if(!((name==='launcher'&&kind==='weather')||(name==='app-currency'&&kind==='rates')))throw new Error('Not allowed');
    const key='cache-'+kind,previous=read(key);
    if(previous&&Date.now()-previous.fetchedAt<(kind==='weather'?15*60000:3600000))return {...previous,cached:true};
    try {
      const url=kind==='weather'?'https://api.open-meteo.com/v1/forecast?latitude=-36.85&longitude=174.76&current=temperature_2m,weather_code&timezone=Pacific%2FAuckland':'https://api.frankfurter.dev/v1/latest?base=NZD';
      const response=await net.fetch(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(kind==='weather'?!Number.isFinite(data.current?.temperature_2m):(!data.rates||!Object.values(data.rates).every(n=>Number.isFinite(n)&&n>0)))throw new Error('Invalid response');
      const value={data,fetchedAt:Date.now()};write(key,value);return value;
    }catch(error){return previous?{...previous,stale:true,error:error.message}:{error:error.message};}
  });
  ipcMain.handle('music-pick',async event=>{
    if(caller(event)!=='launcher')throw new Error('Invalid caller');
    const result=await dialog.showOpenDialog({properties:['openFile','multiSelections'],filters:[{name:'Audio',extensions:['mp3','wav','ogg','m4a','flac','aac']}]});
    if(result.canceled)return null;
    const tracks=result.filePaths.map(file=>({id:crypto.randomUUID(),file,name:path.basename(file,path.extname(file))}));write('music-files',tracks);return tracks.map(({file,...track})=>track);
  });
  ipcMain.handle('music-list',event=>{if(caller(event)!=='launcher')throw new Error('Invalid caller');return (read('music-files')||[]).map(({file,...track})=>track);});
  protocol.handle('aether-media',async request=>{
    const id=new URL(request.url).hostname,track=(read('music-files')||[]).find(track=>track.id===id);
    if(!track)return new Response('Not found',{status:404});
    try {
      const size=fs.statSync(track.file).size,range=request.headers.get('range');let start=0,end=size-1;
      if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;if(start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});}
      const mime={'.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.flac':'audio/flac','.aac':'audio/aac'}[path.extname(track.file).toLowerCase()]||'application/octet-stream';
      const headers={'Content-Type':mime,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'no-store'};if(range)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
      return new Response(request.method==='HEAD'?null:Readable.toWeb(fs.createReadStream(track.file,{start,end})),{status:range?206:200,headers});
    }catch{return new Response('Audio file unavailable',{status:404});}
  });
}
function record(slug,seconds=0) {const usage=read('usage')||{};const item=usage[slug]||{opens:0,seconds:0};if(!seconds){item.opens++;item.lastOpened=Date.now();}item.seconds+=seconds;usage[slug]=item;write('usage',usage);}
function updateTheme(theme){for(const id of clients.keys())webContents.fromId(id)?.send('theme-updated',theme);}
module.exports={read,write,bind,install,record,updateTheme};
