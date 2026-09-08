const {app,BrowserWindow,webContents,dialog}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const folder=process.env.AETHER_CHECK_DIR,phase=process.env.AETHER_CHECK_PHASE;
if(!folder||!['write','read'].includes(phase))throw new Error('Run node scripts/check-modules.cjs');
app.setPath('userData',path.join(folder,'profile'));
const {read}=require('../app-host/services');
require('../main');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<200;i++){const value=await fn();if(value)return value;await delay(50);}throw new Error('Timed out');}
const tests={
  wordle:`if(JSON.stringify(evaluate('allee','apple'))!==JSON.stringify(['correct','present','absent','absent','correct']))throw Error('duplicate letters');for(const c of state.answer)key(c);key('↵');if(state.status!=='won')throw Error('Wordle win');`,
  chess:`document.querySelector('[data-square="e2"]').click();document.querySelector('[data-square="e4"]').click();if(document.querySelector('[data-square]').dataset.square!=='h1')throw Error('black orientation');document.querySelector('[data-square="e7"]').click();document.querySelector('[data-square="e5"]').click();if(document.querySelector('[data-square]').dataset.square!=='a8')throw Error('white orientation');`,
  reaction:`activate();activate();if(phase!=='early'||state.results.length)throw Error('false start');phase='ready';started=performance.now()-250;activate();if(state.results.length!==1||state.results[0].ms<240)throw Error('reaction timing');`,
  pacman:`if(!MAZE.every(row=>row.length===W))throw Error('maze width');const queue=[state.player],seen=new Set();while(queue.length){const p=queue.pop(),k=p.y*W+p.x;if(seen.has(k))continue;seen.add(k);for(const d of Object.values(dirs))if(open(p.x+d.x,p.y+d.y))queue.push({x:p.x+d.x,y:p.y+d.y});}if(!Object.keys(state.food).every(k=>seen.has(Number(k))))throw Error('unreachable pellets');movePlayer();if(state.score!==10)throw Error('pellet');`,
  '2048':`state.board=[2,2,2,2,...Array(12).fill(0)];state.score=0;move('left');if(state.score!==8||state.board[0]!==4||state.board[1]!==4)throw Error('merge');`,
  planner:`const f=$('#add');f.elements.name.value='Math <practice>';f.elements.minutes.value=45;f.requestSubmit();const log=$('#log');log.elements.subject.value='Physics';log.elements.minutes.value=35;log.requestSubmit();if(state.tasks.length!==1||state.sessions[0].minutes!==35)throw Error('planner');`,
  savings:`const f=$('#add');f.elements.note.value='Deposit';f.elements.amount.value='10.10';f.requestSubmit();f.elements.note.value='Withdrawal';f.elements.kind.value='-1';f.elements.amount.value='0.20';f.requestSubmit();if(state.transactions.reduce((s,t)=>s+t.cents,0)!==990)throw Error('money arithmetic');`,
  tetris:`running=true;action('rotate');action('drop');running=false;draw();if(!state.board.some(row=>row.some(Boolean))||!state.score)throw Error('tetris drop');`,
  pomodoro:`state.deadline=Date.now()-100;state.mode='focus';render();if(state.sessions.length!==1)throw Error('timer completion');$('#toggle').click();if(!state.deadline)throw Error('timer start');`,
  minesweeper:`reveal(0);if(state.status==='lost'||state.bombs.length!==10||!state.opened.includes(0))throw Error('first click');const i=state.board?.length||Array.from({length:81},(_,i)=>i).find(i=>!state.opened.includes(i));flag(i);if(!state.flags.includes(i))throw Error('flag');`,
  snake:`turn('up');step();if(state.snake[0].y!==9||state.direction.y!==-1)throw Error('snake move');`,
  sudoku:`if(solutions(state.givens.slice())!==1)throw Error('unique sudoku');const i=state.givens.indexOf(0);choose(i);document.querySelector('[data-number="'+state.solution[i]+'"]').click();if(state.board[i]!==state.solution[i])throw Error('sudoku input');`,
  notepad:`$('#new').click();$('#title').value='Test <note>';$('#title').dispatchEvent(new Event('input'));$('#body').value='Retain this after a forced process exit. 中文';$('#body').dispatchEvent(new Event('input'));if(state.notes[0].body.indexOf('中文')<0)throw Error('note edit');`,
  habits:`const f=$('#add');f.elements.name.value='Run';f.elements.kind.value='exercise';f.requestSubmit();document.querySelector('[data-check]').click();if(state.habits[0].days.length!==1)throw Error('check-in');`,
  currency:`if(!state.rates){state.rates={NZD:1,USD:.6,EUR:.5};state.date='2026-09-08';options();}$('#amount').value=10;$('#amount').dispatchEvent(new Event('input'));if(!$('#result').textContent.includes('USD'))throw Error('conversion');`,
  breakout:`state.x=40;state.y=68;state.vx=0;state.vy=-230;step(.02);if(state.bricks[0]!==false||state.score!==10)throw Error('brick collision');draw();`
};
app.whenReady().then(async()=>{
  try{
    const hub=BrowserWindow.getAllWindows()[0];hub.webContents.on('console-message',event=>{if(event.level==='error')console.error('Hub:',event.message);});
    await until(()=>hub.webContents.executeJavaScript('typeof refreshApps==="function"&&typeof showHubPage==="function"').catch(()=>false));
    await hub.webContents.executeJavaScript('refreshApps()');await until(()=>hub.webContents.executeJavaScript('!scanning&&localApps.length===5&&APPS.every(a=>a.playable)'));
    const catalog=await hub.webContents.executeJavaScript('[...APPS,...localApps.map(a=>({...a,id:a.slug,launchId:a.id}))].map(a=>({id:a.id,name:a.name,playable:a.playable,launchId:a.launchId}))');
    assert.equal(catalog.length,17);assert.ok(catalog.every(a=>a.playable));
    const expected=phase==='read'?JSON.parse(fs.readFileSync(path.join(folder,'ready.json'),'utf8')):{};
    const actual={};
    for(const {id,name,launchId} of catalog){
      const result=await hub.webContents.executeJavaScript(`window.launcher.openApp(${JSON.stringify(launchId)})`);assert.ok(!result.error,result.error);
      const content=await until(()=>webContents.getAllWebContents().find(c=>c.getURL().startsWith('aether-app://'+(id==='2048'?'app-2048':id)+'/')));
      await until(()=>content.executeJavaScript(id==='hotswap'?'window.gameReady':'!!document.querySelector("#message")').catch(()=>false));
      const host=BrowserWindow.getAllWindows().find(w=>w!==hub&&new URL(w.webContents.getURL()).searchParams.get('name')===name);
      if(id==='currency')await until(()=>content.executeJavaScript('!document.querySelector("#refresh").disabled').catch(()=>false));
      assert.equal(await content.executeJavaScript('typeof require+":"+typeof window.launcher'),'undefined:undefined');
      if(phase==='write'){
        if(id==='hotswap'){host.setAlwaysOnTop(true);host.show();host.focus();content.focus();await delay(200);await content.executeJavaScript('document.querySelector("#start").click();window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyW"}));');await until(()=>content.executeJavaScript('appStore.read()?.checkpoint?.elapsed>0'));await content.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keyup",{code:"KeyW"}));document.querySelector("#pauseBtn").click();');assert.ok((await content.executeJavaScript('appStore.read()')).checkpoint.elapsed>0);host.setAlwaysOnTop(false);}else await content.executeJavaScript(tests[id]);
        if(id!=='hotswap')assert.equal(await content.executeJavaScript('document.querySelector("#save-status").classList.contains("error")'),false,id+' save');
        assert.equal(await content.executeJavaScript('fetch("https://example.com").then(()=>false,()=>true)'),true,id+' network isolation');
        assert.equal(await content.executeJavaScript('fetch("/%2e%2e%2fmain.js").then(r=>r.status)'),404);
        if(id!=='currency')assert.equal(await content.executeJavaScript('appStore.rates().then(()=>false,()=>true)'),true,'scoped rates');
        actual[id]=await content.executeJavaScript('appStore.read()');
      }else{assert.deepEqual(await content.executeJavaScript('appStore.read()'),expected[id],id+' persisted');if(id==='hotswap')assert.equal(await content.executeJavaScript('document.querySelector("#pause").classList.contains("hidden")'),false,'chase resumes paused');if(['snake','tetris','breakout','pacman'].includes(id))assert.equal(await content.executeJavaScript('running'),false,id+' resumes paused');}
      console.log('PASS: '+phase+' '+id);
      if(phase==='read'){host.close();await until(()=>host.isDestroyed());}
    }
    hub.show();hub.focus();await hub.webContents.executeJavaScript('refreshSummary()');
    if(phase==='write'){
      await hub.webContents.executeJavaScript(`document.querySelector('[data-favorite="snake"]').click();const f=document.querySelector('#add-task');f.querySelector('input').value='Persistent task';f.requestSubmit();`);
      await hub.webContents.executeJavaScript(`showHubPage('Settings')`);
      await hub.webContents.executeJavaScript(`{const f=document.querySelector('#settings-form');f.elements.displayName.value='Local tester';f.elements.theme.value='light';f.requestSubmit();dialog.close();}`);
      assert.equal(await hub.webContents.executeJavaScript('settings.name'),'Local tester');
      const wave=Buffer.alloc(44+44100*2*5);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(44100,24);wave.writeUInt32LE(88200,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);const audioPath=path.join(folder,'test.wav');fs.writeFileSync(audioPath,wave);
      dialog.showOpenDialog=async()=>({canceled:false,filePaths:[audioPath]});
      await hub.webContents.executeJavaScript('chooseMusic()');
      await until(()=>hub.webContents.executeJavaScript('!loadingTrack&&Number.isFinite(audio.duration)&&audio.duration>0'));
      await hub.webContents.executeJavaScript('audio.pause();audio.currentTime=2;music.time=2;saveMusic();');
      assert.equal(await hub.webContents.executeJavaScript('Math.round(audio.duration)'),5);
      actual.launcher=read('launcher');
      fs.writeFileSync(path.join(folder,'hub-light.png'),(await hub.webContents.capturePage()).toPNG());
      await hub.webContents.executeJavaScript(`document.querySelector('[data-theme-choice="dark"]').click()`);actual.launcher=read('launcher');
      await delay(200);fs.writeFileSync(path.join(folder,'hub-dark.png'),(await hub.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(folder,'ready.json'),JSON.stringify(actual));
      console.log('READY: force termination now');
    }else{
      assert.equal(await hub.webContents.executeJavaScript('settings.name'),'Local tester');assert.equal(await hub.webContents.executeJavaScript('favorites.has("snake")'),true);assert.equal(await hub.webContents.executeJavaScript('tasks[0].name'),'Persistent task');
      await until(()=>hub.webContents.executeJavaScript('!loadingTrack&&Number.isFinite(audio.duration)&&audio.duration>0'));
      assert.equal(await hub.webContents.executeJavaScript('Math.round(audio.currentTime)'),2);assert.equal(await hub.webContents.executeJavaScript('audio.paused'),true);
      assert.equal(read('launcher')['aether-theme'],expected.launcher['aether-theme']);
      console.log('PASS: launcher settings, favorites, tasks, audio file and seek restored after forced termination');app.exit(0);
    }
  }catch(error){console.error(error);console.error(await BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript('JSON.stringify({music,tracks,loadingTrack,src:audio.currentSrc,duration:audio.duration,preload:audio.preload,state:audio.readyState,network:audio.networkState,error:audio.error?.message})').catch(()=>''));app.exit(1);}
});
