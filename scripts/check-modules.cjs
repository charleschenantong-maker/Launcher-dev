const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'output','module-check-'+Date.now());
fs.mkdirSync(folder,{recursive:true});
const electron=path.join(root,'node_modules','electron','dist','electron.exe');
async function run(phase){
  const env={...process.env,AETHER_CHECK_DIR:folder,AETHER_CHECK_PHASE:phase};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,[path.join(__dirname,'module-worker.cjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',data=>{logs+=data;process.stdout.write(data);});child.stderr.on('data',data=>{logs+=data;});
  const exit=new Promise(resolve=>child.once('exit',code=>resolve(code)));
  const timeout=setTimeout(()=>{spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});},120000);timeout.unref();
  if(phase==='write'){
    for(let i=0;i<1200&&!fs.existsSync(path.join(folder,'ready.json'));i++){if(child.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,100));}
    assert.ok(fs.existsSync(path.join(folder,'ready.json')),'write phase completed');
    const killed=spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,encoding:'utf8'});assert.equal(killed.status,0,killed.stderr);await exit;console.log('PASS: forcibly terminated the isolated Electron process tree');
  }else{const code=await exit;assert.equal(code,0,logs);}
  clearTimeout(timeout);
}
(async()=>{await run('write');await run('read');console.log('PASS: all modules and restart persistence. Evidence: '+folder);})().catch(error=>{console.error(error);process.exitCode=1;});
