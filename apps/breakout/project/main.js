const LEVELS={easy:{lives:5,speed:.75},medium:{lives:3,speed:1},hard:{lives:2,speed:1.3}};
function fresh(difficulty=state?.difficulty||'medium'){return {x:350,y:440,vx:180,vy:-230,paddle:300,bricks:Array(50).fill(true),score:0,lives:LEVELS[difficulty].lives,level:1,status:'playing',difficulty};}
load(fresh());
state.difficulty??='medium';
shell('<div class="toolbar"><label>Difficulty <select id="difficulty"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><button id="toggle">Resume</button><button id="new">New game</button><strong id="score"></strong></div><p>Move with your mouse, touch, or ← → / A D. Space pauses. Reopened games wait for Resume.</p><canvas id="canvas" width="700" height="500" aria-label="Breakout playfield" style="touch-action:none"></canvas>');
$('#difficulty').value=state.difficulty;
$('#difficulty').onchange=()=>{if(confirm('Start a new game with this difficulty?')){running=false;state=fresh($('#difficulty').value);save();draw();}else $('#difficulty').value=state.difficulty;};
let running=false,last=0,savedAt=0;const keys=new Set(),ctx=$('#canvas').getContext('2d');
function draw(){ctx.clearRect(0,0,700,500);state.bricks.forEach((alive,i)=>{if(alive){ctx.fillStyle=['#ed7976','#f0ad64','#e2cf67','#5dc7b7','#689bea'][Math.floor(i/10)];ctx.fillRect(10+i%10*69,40+Math.floor(i/10)*24,63,18);}});ctx.fillStyle='#c8e1ff';ctx.fillRect(state.paddle,470,100,12);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(state.x,state.y,7,0,Math.PI*2);ctx.fill();$('#score').textContent='Score '+state.score+' · Lives '+state.lives+' · Level '+state.level;$('#toggle').textContent=running?'Pause':'Resume';$('#toggle').disabled=state.status!=='playing';message(state.status==='lost'?'Game over. Start a new game.':running?'':'Paused · progress saved');}
function step(dt){dt*=LEVELS[state.difficulty].speed;if(keys.has('ArrowLeft')||keys.has('a'))state.paddle-=450*dt;if(keys.has('ArrowRight')||keys.has('d'))state.paddle+=450*dt;state.paddle=Math.max(0,Math.min(600,state.paddle));const oldY=state.y;state.x+=state.vx*dt;state.y+=state.vy*dt;
  if(state.x<7){state.x=7;state.vx=Math.abs(state.vx);}if(state.x>693){state.x=693;state.vx=-Math.abs(state.vx);}if(state.y<7){state.y=7;state.vy=Math.abs(state.vy);}
  if(state.vy>0&&state.y+7>=470&&oldY+7<=482&&state.x>=state.paddle-7&&state.x<=state.paddle+107){state.y=463;const offset=(state.x-state.paddle-50)/50;state.vx=offset*270;state.vy=-Math.sqrt(Math.max(160**2,(300+state.level*15)**2-state.vx**2));}
  for(let i=0;i<50;i++){if(!state.bricks[i])continue;const x=10+i%10*69,y=40+Math.floor(i/10)*24;if(state.x+7>=x&&state.x-7<=x+63&&state.y+7>=y&&state.y-7<=y+18){state.bricks[i]=false;state.score+=10;if(oldY+7<=y||oldY-7>=y+18)state.vy=-state.vy;else state.vx=-state.vx;save();break;}}
  if(state.y>510){state.lives--;running=false;if(!state.lives)state.status='lost';state.x=state.paddle+50;state.y=440;state.vx=180;state.vy=-230;save();}
  if(state.bricks.every(v=>!v)){state.level++;state.bricks.fill(true);state.x=350;state.y=440;state.vx=180;state.vy=-230;running=false;save();}
}
function toggle(){if(state.status!=='playing')return;running=!running;last=performance.now();save();draw();}
$('#toggle').onclick=toggle;$('#new').onclick=()=>{if(confirm('Start a new game?')){running=false;state=fresh();save();draw();}};
$('#canvas').onpointermove=e=>{const rect=e.target.getBoundingClientRect();state.paddle=Math.max(0,Math.min(600,(e.clientX-rect.left)/rect.width*700-50));if(!running){save();draw();}};
document.onkeydown=e=>{if(['ArrowLeft','ArrowRight','a','d'].includes(e.key)){e.preventDefault();keys.add(e.key);}if(e.code==='Space'){e.preventDefault();toggle();}};document.onkeyup=e=>keys.delete(e.key);
window.addEventListener('blur',()=>{running=false;keys.clear();save();draw();});
function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;if(running){const steps=Math.ceil(dt/.008);for(let i=0;i<steps&&running;i++)step(dt/steps);if(now-savedAt>250){save();savedAt=now;}draw();}requestAnimationFrame(frame);}draw();requestAnimationFrame(frame);
