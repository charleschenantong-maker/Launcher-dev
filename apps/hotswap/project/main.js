
import * as THREE from "./vendor/three.module.js";
import {archive,archiveData,saveArchive} from "./storage.js";
let difficulty=['easy','medium','hard'].includes(archiveData.prefs?.difficulty)?archiveData.prefs.difficulty:'medium';
class ChaseAudio {
  constructor() {
    this.ctx = null; this.muted = false; this.voices = []; this.phase = 0; this.tick = 0;
  }
  async start() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    try {
      if (!this.ctx) this.init(new Audio());
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx.state === 'running';
    } catch { return false; }
  }
  init(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : .68;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16; limiter.knee.value = 16; limiter.ratio.value = 5;
    limiter.attack.value = .003; limiter.release.value = .15;
    this.master.connect(limiter); limiter.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.motor = ctx.createGain(); this.motor.gain.value = 0;
    this.motorFilter = ctx.createBiquadFilter(); this.motorFilter.type = 'lowpass';
    this.motorFilter.Q.value = .6; this.motorFilter.frequency.value = 450;
    this.motor.connect(this.motorFilter); this.motorFilter.connect(this.master);
    this.engine = this.oscillator('sawtooth', 43, this.motor);
    this.engine2 = this.oscillator('triangle', 86.5, this.motor);
    this.road = ctx.createGain(); this.road.gain.value = 0;
    const roadFilter = ctx.createBiquadFilter(); roadFilter.type = 'bandpass';
    roadFilter.frequency.value = 650; roadFilter.Q.value = .55;
    const roadNoise = ctx.createBufferSource(); roadNoise.buffer = this.noise; roadNoise.loop = true;
    roadNoise.connect(roadFilter); roadFilter.connect(this.road); this.road.connect(this.master); roadNoise.start();
    this.siren = ctx.createGain(); this.siren.gain.value = 0; this.siren.connect(this.master);
    this.siren1 = this.oscillator('sine', 680, this.siren);
    this.siren2 = this.oscillator('sine', 1010, this.siren);
  }
  oscillator(type, frequency, output) {
    const oscillator = this.ctx.createOscillator();
    oscillator.type = type; oscillator.frequency.value = frequency;
    oscillator.connect(output); oscillator.start(); return oscillator;
  }
  setMuted(value) {
    this.muted = !!value;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : .68, this.ctx.currentTime, .025);
  }
  update(speed01, threat01, dt, active = true) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const speed = Number.isFinite(speed01) ? Math.max(0, Math.min(1, speed01)) : 0;
    const threat = Number.isFinite(threat01) ? Math.max(0, Math.min(1, threat01)) : 0;
    const delta = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    this.phase += delta; this.tick += delta;
    if (this.tick < .035 && active) return;
    this.tick = 0;
    const now = this.ctx.currentTime;
    const set = (param, value) => param.setTargetAtTime(value, now, .065);
    const gear = Math.min(3, Math.floor(speed * 3.8));
    const rpm = 44 + speed * 160 - gear * 23 + Math.sin(this.phase * 21) * .7;
    set(this.engine.frequency, rpm); set(this.engine2.frequency, rpm * 2.014);
    set(this.motorFilter.frequency, 300 + speed * 1100);
    set(this.motor.gain, active ? .033 + speed * .023 : 0);
    set(this.road.gain, active ? speed * speed * .047 : 0);
    const wail = Math.sin(this.phase * (3.5 + threat * 2));
    set(this.siren1.frequency, 700 + wail * 230);
    set(this.siren2.frequency, 1030 + Math.sin(this.phase * 4.8 + .6) * 190);
    set(this.siren.gain, active ? threat * .014 : 0);
  }
  voice(type, from, to, duration, volume, delay = 0) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    while (this.voices.length >= 12) {
      const oldest = this.voices.shift();
      try { oldest.source.stop(); } catch {}
      oldest.source.disconnect(); oldest.gain.disconnect(); oldest.filter.disconnect();
    }
    const ctx = this.ctx, start = ctx.currentTime + delay;
    const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    let source;
    if (type === 'noise') {
      source = ctx.createBufferSource(); source.buffer = this.noise;
      filter.type = 'lowpass'; filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + duration);
    } else {
      source = ctx.createOscillator(); source.type = type;
      source.frequency.setValueAtTime(from, start);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
      filter.type = 'lowpass'; filter.frequency.value = 4400;
    }
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    const voice = { source, gain, filter }; this.voices.push(voice);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); filter.disconnect();
      const index = this.voices.indexOf(voice); if (index >= 0) this.voices.splice(index, 1);
    };
    source.start(start); source.stop(start + duration + .025);
  }
  effect(kind) {
    switch (kind) {
      case 'swap':
        this.voice('sine', 180, 1550, .24, .19);
        this.voice('triangle', 990, 660, .35, .1, .15); break;
      case 'hit':
        this.voice('noise', 1900, 130, .2, .24);
        this.voice('sine', 100, 35, .22, .27); break;
      case 'wreck':
        this.voice('noise', 3300, 70, .85, .4);
        this.voice('sine', 115, 26, .65, .36); break;
      case 'wanted':
        this.voice('triangle', 440, 440, .16, .11);
        this.voice('triangle', 660, 660, .25, .12, .15); break;
      case 'turbo':
        this.voice('sawtooth', 110, 880, .42, .16);
        this.voice('triangle', 220, 1320, .34, .1, .08); break;
      case 'start':
        [330, 440, 660].forEach((note, i) => this.voice('triangle', note, note * 1.01, .26, .12, i * .09));
    }
  }
}


const $=id=>document.getElementById(id), clamp=THREE.MathUtils.clamp, TAU=Math.PI*2;
let worldRandom=761;
function worldRand(){worldRandom=(worldRandom*1664525+1013904223)>>>0;return worldRandom/4294967296;}
const rand=(a,b)=>a+worldRand()*(b-a), choice=a=>a[Math.floor(worldRand()*a.length)];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)), dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const scene=new THREE.Scene();scene.background=new THREE.Color('#d9bdaf');scene.fog=new THREE.Fog('#d9bdaf',115,330);
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,285);scene.add(camera);
scene.add(new THREE.HemisphereLight('#e7fff1','#66817c',2.5));
const sun=new THREE.DirectionalLight('#fff0cf',3.3);sun.position.set(-35,65,28);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:180});sun.shadow.bias=-.0005;sun.shadow.normalBias=.07;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;scene.add(sun,sun.target);
const boxGeo=new THREE.BoxGeometry(1,1,1), materials=new Map(), batches=new Map(), dummy=new THREE.Object3D();
let batchZone='global';
const cityChunks=[];
function mat(c,emissive=false){let k=c+':'+emissive;if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color:c,roughness:.78,metalness:.08,emissive:emissive?c:0,emissiveIntensity:emissive?.7:0}));return materials.get(k);}
function box(parent,x,y,z,w,h,d,color){const m=new THREE.Mesh(boxGeo,mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const cockpit=new THREE.Group();camera.add(cockpit);
const cockpitInterior=new THREE.Group(),cockpitExterior=new THREE.Group();cockpit.add(cockpitInterior,cockpitExterior);
box(cockpitInterior,0,-.84,-1.03,2.82,.22,.68,'#1b3037');
box(cockpitInterior,0,-.68,-1.26,2.66,.06,.18,'#48676d');
const binnacle=box(cockpitInterior,-.28,-.64,-1.25,.62,.1,.34,'#101e25');binnacle.rotation.x=-.14;
box(cockpitInterior,-.28,-.585,-1.25,.48,.025,.17,'#6eead7');
box(cockpitInterior,-.28,-.55,-1.25,.2,.018,.06,'#e4ff74');
box(cockpitInterior,0,.72,-1.62,.52,.09,.08,'#172a31');
box(cockpitInterior,0,.59,-1.61,.06,.22,.06,'#273e45');
const hood=box(cockpitExterior,0,-.82,-2.55,2.2,.1,2.9,'#ef929b');hood.material=mat('#ef929b').clone();
box(cockpitExterior,0,-.885,-.62,2.28,.08,.16,'#14282f');
for(const side of [-1,1]){
 const pillar=box(cockpitInterior,side*1.2,-.03,-1.22,.09,1.52,.11,'#304b52');pillar.rotation.z=side*.13;
 box(cockpitExterior,side*.98,-.77,-1.7,.2,.1,1.8,'#314c53');
}
const wheel=new THREE.Group();wheel.position.set(-.48,-.6,-.79);cockpitInterior.add(wheel);
const rim=new THREE.Mesh(new THREE.TorusGeometry(.27,.035,5,14),mat('#152d35'));wheel.add(rim);
box(wheel,0,0,0,.45,.04,.04,'#526d70');box(wheel,0,-.11,0,.04,.24,.04,'#526d70');box(wheel,0,0,.01,.12,.08,.05,'#e4ff74');
cockpit.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
function block(x,y,z,w,h,d,c,rot=0){const key=batchZone+'|'+c;if(!batches.has(key))batches.set(key,[]);batches.get(key).push([x,y,z,w,h,d,rot]);}
const GRID_SECTORS=16,SECTOR=58,ROAD_HALF=9.5;
const roadLines=Array.from({length:GRID_SECTORS+1},(_,i)=>(i-GRID_SECTORS/2)*SECTOR);
const WORLD_MIN=roadLines[0],WORLD_MAX=roadLines[roadLines.length-1],WORLD_EDGE=WORLD_MAX+13;
const ROAD_SPAN=WORLD_MAX-WORLD_MIN+40,GROUND_SPAN=WORLD_EDGE*2+90;
const solids=[],sites=[];
block(0,-.65,0,GROUND_SPAN,1,GROUND_SPAN,'#8daf91');
block(WORLD_MIN-38,-.12,0,48,.2,GROUND_SPAN*.96,'#71a9a7');
for(const r of roadLines){
 block(r,-.05,0,19,.16,ROAD_SPAN,'#304b53');
 block(0,-.052,r,ROAD_SPAN,.16,19,'#304b53');
 block(r-.52,-.075,0,.52,.12,ROAD_SPAN,'#263e46');block(r+.52,-.075,0,.52,.12,ROAD_SPAN,'#263e46');
 block(0,-.077,r-.52,ROAD_SPAN,.12,.52,'#263e46');block(0,-.077,r+.52,ROAD_SPAN,.12,.52,'#263e46');
 for(let p=WORLD_MIN-8;p<=WORLD_MAX+8;p+=8){if(roadLines.some(v=>Math.abs(v-p)<11))continue;
  block(r,.045,p,.14,.025,2.6,'#e5cf9e');block(r+4.8,.042,p,.09,.022,2.1,'#85a8a3');block(r-4.8,.042,p,.09,.022,2.1,'#85a8a3');
  block(p,.045,r,2.6,.025,.14,'#e5cf9e');block(p,.042,r+4.8,2.1,.022,.09,'#85a8a3');block(p,.042,r-4.8,2.1,.022,.09,'#85a8a3');
 }
 for(const side of [-1,1]){
  block(r+side*9.45,.1,0,.3,.12,ROAD_SPAN,'#d7c9aa');block(r+side*9.05,.125,0,.08,.09,ROAD_SPAN,'#718e8b');
  block(0,.1,r+side*9.45,ROAD_SPAN,.12,.3,'#d7c9aa');block(0,.125,r+side*9.05,ROAD_SPAN,.09,.08,'#718e8b');
 }
}
for(let i=0;i<roadLines.length;i++)for(let j=0;j<roadLines.length;j++){
 const x=roadLines[i],z=roadLines[j];
 for(let k=-3;k<=3;k++){
  block(x+k*1.1,.06,z-8,.62,.04,2.1,'#e6e0c8');block(x+k*1.1,.06,z+8,.62,.04,2.1,'#e6e0c8');
  block(x-8,.06,z+k*1.1,2.1,.04,.62,'#e6e0c8');block(x+8,.06,z+k*1.1,2.1,.04,.62,'#e6e0c8');
 }
 if(i<GRID_SECTORS)sites.push({x:x+SECTOR/2,z,axis:'x'});if(j<GRID_SECTORS)sites.push({x,z:z+SECTOR/2,axis:'z'});
}
let citySeed=761;function seeded(){citySeed=(citySeed*1664525+1013904223)>>>0;return citySeed/4294967296;}
const facades=['#d99b86','#e7c39f','#8eada4','#b5a5b7','#dda89e','#789aa2','#d1b99c','#a8b9c7','#c79773','#8d9d83'];
const roofTones=['#718985','#829791','#9c968d','#647f83','#596f72'];
function tree(x,z){block(x,1.15,z,.42,2.2,.42,'#625f55');block(x,3.1,z,2.6,2.2,2.6,'#4f836f');block(x-.45,4.25,z+.15,1.9,1.25,1.9,'#83aa85');}
function cityWindowRows(bx,bz,w,d,fromY,toY,spacing=3.05){
 for(let level=fromY;level<toY-.8;level+=spacing){
  const cols=Math.max(2,Math.min(5,Math.floor(w/3.25)));
  for(let t=0;t<cols;t++){const u=cols===1?0:(t/(cols-1)-.5)*(w-3.2),win=seeded()>.2?'#557c86':'#e7c88e';block(bx+u,level,bz+d/2+.018,1.45,1.18,.05,win);block(bx+u,level,bz-d/2-.018,1.45,1.18,.05,win);}
  const sideCols=Math.max(2,Math.min(5,Math.floor(d/3.2)));
  for(let t=0;t<sideCols;t++){const u=sideCols===1?0:(t/(sideCols-1)-.5)*(d-3.1),win=seeded()>.2?'#557c86':'#e7c88e';block(bx+w/2+.018,level,bz+u,.05,1.18,1.4,win);block(bx-w/2-.018,level,bz+u,.05,1.18,1.4,win);}
 }
}
function rooftopKit(bx,bz,w,d,y,style){
 const roof=roofTones[Math.floor(seeded()*roofTones.length)];block(bx,y+.16,bz,w+.34,.32,d+.34,'#e8dfc8');
 if(style==='tower'||style==='slab'||seeded()>.42){const pw=Math.max(2.4,w*.32),pd=Math.max(2.2,d*.28);block(bx+rand(-1.2,1.2),y+.58,bz+rand(-1.2,1.2),pw,.82,pd,roof);}
 if(style==='tower'||style==='slab'||seeded()>.68){const ax=bx+rand(-w*.2,w*.2),az=bz+rand(-d*.2,d*.2);block(ax,y+1.72,az,.12,2.7,.12,'#536f73');block(ax+.58,y+2.66,az,.95,.08,.08,'#536f73');}
 if(seeded()>.72){block(bx-w*.24,y+.72,bz+d*.18,1.2,.7,1.45,'#677d7f');block(bx+w*.18,y+.58,bz-d*.21,1.55,.5,1.05,'#829791');}
}
function addCityBuilding(bx,bz,w,d,h,c,style){
 solids.push({x:bx,z:bz,w:w/2,d:d/2});const awning=choice(['#cf7f76','#75a99c','#dfc377']);
 if(style==='tower'){
  const podiumH=rand(4.2,6.2),tw=w*rand(.46,.68),td=d*rand(.46,.68),tx=bx+rand(-w*.09,w*.09),tz=bz+rand(-d*.09,d*.09),towerH=Math.max(15,h-podiumH);
  block(bx,podiumH/2+.4,bz,w,podiumH,d,c);block(bx,1.65,bz+d/2+.56,w*.78,.32,1.08,awning);block(tx,podiumH+towerH/2+.35,tz,tw,towerH,td,c);cityWindowRows(tx,tz,tw,td,podiumH+1.9,podiumH+towerH,3.0);rooftopKit(tx,tz,tw,td,podiumH+towerH+.35,'tower');
 }else if(style==='stepped'){
  const lower=h*.52,uw=w*rand(.62,.8),ud=d*rand(.58,.78),ux=bx+rand(-1.2,1.2),uz=bz+rand(-1.2,1.2);block(bx,lower/2+.4,bz,w,lower,d,c);cityWindowRows(bx,bz,w,d,2.1,lower,3.0);block(ux,lower+(h-lower)/2+.35,uz,uw,h-lower,ud,c);cityWindowRows(ux,uz,uw,ud,lower+1.5,h,3.0);block(bx,1.65,bz+d/2+.56,w*.72,.3,1.02,awning);rooftopKit(ux,uz,uw,ud,h+.35,'stepped');
 }else if(style==='slab'){
  block(bx,h/2+.4,bz,w,h,d,c);cityWindowRows(bx,bz,w,d,2.2,h,3.05);for(let y=4;y<h;y+=6)block(bx+w/2+.12,y,bz,.16,.14,d*.78,'#d2aa78');rooftopKit(bx,bz,w,d,h+.35,'slab');
 }else if(style==='warehouse'){
  block(bx,h/2+.4,bz,w,h,d,c);for(let x=-w*.38;x<=w*.38;x+=Math.max(3.6,w/6))block(bx+x,h+.62,bz,.22,.7,d*.92,'#829791');for(let x=-w*.34;x<=w*.34;x+=w*.23)block(bx+x,1.45,bz+d/2+.07,w*.16,1.8,.12,'#334f58');block(bx,2.5,bz-d/2-.05,w*.55,.9,.1,'#557c86');rooftopKit(bx,bz,w,d,h+.25,'warehouse');
 }else if(style==='civic'){
  const wingH=h*.46,coreW=w*.45,coreD=d*.48;block(bx,wingH/2+.4,bz,w,wingH,d,c);block(bx,h/2+.4,bz,coreW,h,coreD,c);for(const side of [-1,1])block(bx+side*w*.31,wingH+.85,bz,w*.2,1.7,d*.72,'#e8dfc8');cityWindowRows(bx,bz,coreW,coreD,wingH+1.3,h,3.0);block(bx,1.6,bz+d/2+.1,w*.58,.3,.6,awning);rooftopKit(bx,bz,coreW,coreD,h+.35,'civic');
 }else{
  block(bx,h/2+.4,bz,w,h,d,c);cityWindowRows(bx,bz,w,d,2.1,h,style==='low'?2.8:3.0);block(bx,1.62,bz+d/2+.55,w*.7,.3,1.05,awning);rooftopKit(bx,bz,w,d,h+.35,style);if(style==='mid'&&seeded()>.45){for(let y=4.1;y<h-1;y+=5.6)block(bx+w/2+.18,y,bz,d*.1,.16,d*.62,'#d2aa78');}
 }
 if(!['warehouse','civic'].includes(style))for(const side of [-1,1])block(bx+side*(w/2-.24),Math.min(h*.5,6),bz,.18,Math.min(h*.72,10),.24,'#b0c0b0');
}
function makePark(x,z){block(x,.46,z,35,.12,35,'#91af8f');block(x,.53,z,4,.06,35,'#d8ceb0');block(x,.53,z,35,.06,4,'#d8ceb0');block(x,.63,z,8,.2,8,'#d1d8bc');block(x,.76,z,6,.25,6,'#79aead');for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){tree(x+a*11,z+b*11);tree(x+a*7,z+b*13);}}
for(let i=0;i<GRID_SECTORS;i++)for(let j=0;j<GRID_SECTORS;j++){
 batchZone='s'+i+'_'+j;
 const x=(roadLines[i]+roadLines[i+1])/2,z=(roadLines[j]+roadLines[j+1])/2;block(x,.12,z,38,.5,38,'#c1bbaa');block(x,.39,z,36,.08,36,'#aab795');const districtRoll=seeded();
 if(districtRoll<.075){makePark(x,z);continue;}
 if(districtRoll<.255){
  const c=facades[Math.floor(seeded()*facades.length)],roll=seeded();let style,w=rand(32.5,36.2),d=rand(32.5,36.2),h;
  if(roll<.28){style='warehouse';h=rand(5.2,8.5);}else if(roll<.48){style='civic';h=rand(15,24);}else if(roll<.72){style='stepped';h=rand(20,34);}else{style='tower';h=rand(34,58);}
  addCityBuilding(x+rand(-.8,.8),z+rand(-.8,.8),w,d,h,c,style);if(seeded()>.5){tree(x-16,z-15);tree(x+16,z+15);}continue;
 }
 if(districtRoll<.37){
  const vertical=seeded()>.5;for(const side of [-1,1]){const c=facades[Math.floor(seeded()*facades.length)],bx=x+(vertical?side*9.8:rand(-1,1)),bz=z+(vertical?rand(-1,1):side*9.8),w=vertical?rand(13,16):rand(29,33),d=vertical?rand(29,33):rand(13,16),h=rand(12,30),style=seeded()>.62?'slab':'mid';addCityBuilding(bx,bz,w,d,h,c,style);}continue;
 }
 for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){
  const bx=x+a*8.8+rand(-1.3,1.3),bz=z+b*8.8+rand(-1.3,1.3),roll=seeded();let style='mid',w=rand(9.6,14.3),d=rand(9.2,14),h=rand(9,16);
  if(roll<.18){style='low';w=rand(12.5,15.4);d=rand(9.5,13.8);h=rand(4.2,7.2);}else if(roll>.9){style='tower';w=rand(11.2,14.4);d=rand(10.8,14.2);h=rand(24,42);}else if(roll>.7){style='stepped';w=rand(10.8,14.5);d=rand(10.2,14.2);h=rand(14,25);}else if(roll>.58){style='slab';w=rand(9.5,12);d=rand(13,15);h=rand(17,30);}
  const c=facades[Math.floor(seeded()*facades.length)];addCityBuilding(bx,bz,w,d,h,c,style);
 }
 if(seeded()>.3){tree(x-16,z);tree(x+16,z);}
}
batchZone='global';
for(let i=1;i<GRID_SECTORS;i+=2)for(let j=1;j<GRID_SECTORS;j+=2){const x=roadLines[i]+11,z=roadLines[j]+11;block(x,3.15,z,.16,6.3,.16,'#3d5a5d');block(x-1.05,6.22,z,2.25,.16,.2,'#3d5a5d');block(x-1.85,6.08,z,.62,.13,.42,'#f4ddb0');}
const NO_SHADOW_COLORS=new Set(['#304b53','#263e46','#e5cf9e','#85a8a3','#d7c9aa','#718e8b','#e6e0c8','#557c86','#e7c88e']);
for(const [key,list] of batches){
 const split=key.indexOf('|'),zone=key.slice(0,split),c=key.slice(split+1),inst=new THREE.InstancedMesh(boxGeo,mat(c),list.length);
 for(let i=0;i<list.length;i++){const [x,y,z,w,h,d,r]=list[i];dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,r,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}
 inst.castShadow=zone!=='global'&&!NO_SHADOW_COLORS.has(c);inst.receiveShadow=true;inst.frustumCulled=true;
 // Critical for the 16x16 map: each block is its own render chunk. This lets Three.js
 // discard off-screen districts instead of drawing the entire city every frame.
 if(zone[0]==='s'){
  const parts=zone.slice(1).split('_'),si=Number(parts[0]),sj=Number(parts[1]);
  inst.userData.cityChunk=true;inst.userData.chunkX=(roadLines[si]+roadLines[si+1])/2;inst.userData.chunkZ=(roadLines[sj]+roadLines[sj+1])/2;cityChunks.push(inst);
 }
 inst.computeBoundingBox();inst.computeBoundingSphere();scene.add(inst);
}
batches.clear();
const TYPES={
 coupe:{name:'STINGER',w:1.9,l:3.9,h:.66,max:36,acc:25,turn:1.88,grip:7,hp:100,mass:1,color:'#ef929b'},
 hatch:{name:'ZIP',w:1.8,l:3.2,h:.86,max:31,acc:27,turn:2.3,grip:9,hp:90,mass:.82,color:'#a3ddd0'},
 muscle:{name:'BRUISER',w:2.1,l:4.4,h:.72,max:33,acc:21,turn:1.65,grip:5.8,hp:150,mass:1.65,color:'#f5d278'},
 taxi:{name:'FARE GAME',w:1.95,l:4.1,h:.82,max:31,acc:22,turn:1.85,grip:7,hp:110,mass:1.1,color:'#edc75c'},
 van:{name:'BOX OFFICE',w:2.25,l:4.7,h:1.38,max:27,acc:17,turn:1.5,grip:7,hp:170,mass:1.9,color:'#e4e4cf'},
 truck:{name:'HEAVY METAL',w:2.5,l:6.1,h:1.55,max:23,acc:14,turn:1.25,grip:6,hp:220,mass:2.8,color:'#e59c76'},
 bus:{name:'ALL ABOARD',w:2.5,l:7.4,h:1.4,max:24,acc:13,turn:1.14,grip:6,hp:240,mass:3.2,color:'#96bfc2'},
 sedan:{name:'CRUISER',w:1.92,l:4.35,h:.82,max:32,acc:21,turn:1.82,grip:7.4,hp:120,mass:1.25,color:'#9bb6d1'},
 wagon:{name:'LONGHAUL',w:1.98,l:4.65,h:1.02,max:30,acc:19,turn:1.7,grip:7.6,hp:135,mass:1.42,color:'#9ab48b'},
 roadster:{name:'FLASH',w:1.84,l:3.72,h:.55,max:39,acc:29,turn:2.08,grip:8.2,hp:92,mass:.88,color:'#8fd4ff'},
 pickup:{name:'MULE',w:2.18,l:5.0,h:1.08,max:29,acc:20,turn:1.58,grip:6.6,hp:175,mass:1.9,color:'#d8a26e'},
 minivan:{name:'FAMILY PLAN',w:2.08,l:4.75,h:1.35,max:27,acc:17.5,turn:1.56,grip:7.4,hp:155,mass:1.72,color:'#c0b5d3'},
 delivery:{name:'COURIER',w:2.26,l:5.25,h:1.62,max:25,acc:16,turn:1.42,grip:6.8,hp:185,mass:2.15,color:'#dfd8bf'},
 limo:{name:'STRETCH',w:2.02,l:6.0,h:.86,max:29,acc:16.5,turn:1.3,grip:6.4,hp:165,mass:2.1,color:'#738087'},
 micro:{name:'PEBBLE',w:1.62,l:2.75,h:1.03,max:27,acc:25,turn:2.55,grip:9.4,hp:72,mass:.67,color:'#ef9fc2'},
 sports:{name:'RAZOR',w:1.96,l:4.15,h:.58,max:40,acc:28,turn:2.0,grip:8.4,hp:108,mass:1.0,color:'#ff8d63'},
 classic:{name:'VINTAGE',w:2.0,l:4.75,h:.88,max:28,acc:18,turn:1.55,grip:6.1,hp:140,mass:1.52,color:'#85b8a0'},
 cop:{name:'INTERCEPTOR',w:2,l:4.3,h:.8,max:35,acc:24,turn:1.95,grip:8,hp:120,mass:1.4,color:'#e7e9d7'},
 suv:{name:'ENFORCER',w:2.3,l:4.7,h:1.16,max:31,acc:21,turn:1.75,grip:8,hp:190,mass:2.25,color:'#49616b'}
};
const TRAFFIC_TYPES=['hatch','coupe','muscle','taxi','van','truck','bus','sedan','wagon','roadster','pickup','minivan','delivery','limo','micro','sports','classic'];
const POLICE_TYPES=new Set(['cop','suv']);
const glass='#446470',rubber='#28404a',vehicles=[],policeLights=[];let nextId=0;
const vrGlass=new THREE.MeshStandardMaterial({color:'#173b46',roughness:.18,metalness:.3,side:THREE.DoubleSide});
const vrDoor=new THREE.MeshStandardMaterial({color:'#244d57',roughness:.28,metalness:.2});
const vrRubber=new THREE.MeshStandardMaterial({color:rubber,roughness:.94,metalness:0});
const vrAlloy=new THREE.MeshStandardMaterial({color:'#aebcb5',roughness:.26,metalness:.78});
const vrChrome=new THREE.MeshStandardMaterial({color:'#d4d9ce',roughness:.19,metalness:.86});
const vrTrim=mat('#203942'),vrBelt=mat('#5d7777'),vrSeat=mat('#66736c');
const vrHead=mat('#fff0b4',true),vrTail=mat('#ff6574',true),vrAmber=mat('#e5a25d',true),vrPoliceRed=mat('#ff4d75',true),vrPoliceBlue=mat('#6bbafa',true);
function vrTaperGeo(topW=.84,topD=.8){const bW=.5,bD=.5,tW=topW*.5,tD=topD*.5,p=[[-bW,-.5,-bD],[bW,-.5,-bD],[bW,-.5,bD],[-bW,-.5,bD],[-tW,.5,-tD],[tW,.5,-tD],[tW,.5,tD],[-tW,.5,tD]],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));g.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,4,0,3,4,3,7]);g.computeVertexNormals();return g;}
const vrHullGeo=vrTaperGeo(.93,.92),vrCabGeo=vrTaperGeo(.82,.78),vrSideWindowGeo=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,-.5,-.5,0,-.5,.5,0,.5,.37,0,.5,-.37],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;})();
const vrTireGeo=new THREE.CylinderGeometry(.36,.36,.2,16),vrRimGeo=new THREE.CylinderGeometry(.23,.23,.212,12),vrHubGeo=new THREE.CylinderGeometry(.08,.08,.224,10),vrFenderGeo=new THREE.TorusGeometry(.38,.055,6,14,Math.PI);
function vrPart(parent,geo,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function vrBox(parent,x,y,z,w,h,d,material,rx=0,ry=0,rz=0){return vrPart(parent,boxGeo,material,x,y,z,w,h,d,rx,ry,rz);}
function vrGlassBox(parent,x,y,z,w,h,d,rx=0){return vrBox(parent,x,y,z,w,h,d,vrGlass,rx);}
function vrWindowStrip(body,s,mid,len,y,h){for(const side of [-1,1]){vrPart(body,vrSideWindowGeo,vrGlass,side*(s.w*.407),y,mid,.035,h,len*.74);for(const z of [-.26,.26])vrBox(body,side*(s.w*.422),y,mid+z*len,.045,h*.92,.055,vrTrim);}}
function vrFenders(body,s){for(const side of [-1,1])for(const end of [-1,1])vrPart(body,vrFenderGeo,vrTrim,side*s.w*.49,.39,end*s.l*.3,1,1,1,0,Math.PI/2);}
function vrWheels(g,s,wheels){for(const side of [-1,1])for(const end of [-1,1]){const axle=new THREE.Group();axle.position.set(side*s.w*.49,.39,end*s.l*.3);g.add(axle);vrPart(axle,vrTireGeo,vrRubber,0,0,0,1,1,1,0,0,Math.PI/2);vrPart(axle,vrRimGeo,vrAlloy,0,0,0,1,1,1,0,0,Math.PI/2);vrPart(axle,vrHubGeo,vrChrome,0,0,0,1,1,1,0,0,Math.PI/2);wheels.push(axle);}}
function vrDetails(body,s,type,paint){
 const front=s.l*.48,rear=-s.l*.48;
 for(const side of [-1,1]){const head=vrBox(body,side*s.w*.3,.72,front,s.w*.19,.18,.055,vrHead);const tail=vrBox(body,side*s.w*.31,.72,rear,s.w*.2,.17,.055,vrTail);tail.userData.lamp=true;}
 vrBox(body,0,.48,front,s.w*.82,.13,.12,vrChrome);vrBox(body,0,.48,rear,s.w*.82,.13,.12,vrTrim);
 vrBox(body,0,.61,front-.02,s.w*.48,.09,.035,vrTrim);
 for(const side of [-1,1]){vrBox(body,side*s.w*.44,.91,s.l*.08,.12,.11,.28,vrTrim);vrBox(body,side*s.w*.44,1.01,s.l*.08,.12,.05,.2,vrChrome);}
 if(type==='taxi'){vrBox(body,0,1.88,-.08,.72,.24,.36,vrAmber);vrBox(body,0,.81,0,s.w*.86,.075,.12,vrAmber);for(const side of [-1,1])for(const z of [-.55,.55])vrBox(body,side*s.w*.435,.83,z,.04,.08,.12,vrTrim);}
 if(type==='cop'||type==='suv'){vrBox(body,0,.94,0,s.w*1.01,.24,s.l*.5,vrTrim);vrBox(body,0,1+s.h*.8,0,1.4,.13,.42,vrTrim);}
}
function createVehicle(type,x,z,a,role='traffic',route=null){
 const s=TYPES[type],g=new THREE.Group(),body=new THREE.Group();g.add(body);scene.add(g);
 const color=role==='traffic'&&type!=='taxi'?choice([s.color,'#c8b1cd','#d4e1c8','#e88b78','#82b6b7','#d7c9a6','#9faec6']):s.color;
 const paint=new THREE.MeshStandardMaterial({color,roughness:.34,metalness:.38});
 vrPart(body,vrHullGeo,paint,0,.58,0,s.w*.96,.5,s.l*.94);vrBox(body,0,.34,0,s.w*.84,.13,s.l*.9,vrTrim);vrBox(body,0,.78,0,s.w*.9,.11,s.l*.88,vrBelt);
 if(type==='truck'){
  const cabLen=s.l*.39,cabMid=s.l*.2,cabY=1.12,cabH=.9;
  vrPart(body,vrCabGeo,paint,0,cabY,cabMid,s.w*.94,cabH,cabLen);vrGlassBox(body,0,cabY+.07,cabMid+cabLen*.445+.012,s.w*.75,.5,.045,-.18);vrGlassBox(body,0,cabY+.04,cabMid-cabLen*.445-.012,s.w*.7,.45,.045,.14);
  vrWindowStrip(body,s,cabMid,cabLen,cabY+.05,.42);vrBox(body,0,.93,-s.l*.2,s.w*.92,.12,s.l*.5,paint);vrBox(body,0,1.32,-s.l*.22,s.w*.83,.75,s.l*.38,paint);vrBox(body,0,1.68,-s.l*.22,s.w*.88,.1,s.l*.4,vrTrim);
 }else if(type==='bus'){
   const len=s.l*.82,mid=-.02,cabY=1.14,cabH=.92;vrPart(body,vrCabGeo,paint,0,cabY,mid,s.w*.94,cabH,len);
   vrGlassBox(body,0,cabY+.08,mid+len*.445+.012,s.w*.78,.55,.045,-.12);vrGlassBox(body,0,cabY+.06,mid-len*.445-.012,s.w*.76,.52,.045,.12);
   for(const side of [-1,1])for(let k=-2;k<=2;k++){const wz=mid+k*.94;if(k===1){vrBox(body,side*(s.w*.425),cabY+.03,wz,.05,.93,.72,vrDoor);vrBox(body,side*(s.w*.454),cabY+.03,wz-.37,.04,1.02,.055,vrChrome);vrBox(body,side*(s.w*.454),cabY+.03,wz+.37,.04,1.02,.055,vrChrome);}else{vrGlassBox(body,side*(s.w*.407),cabY+.04,wz,.035,.5,.7);vrBox(body,side*(s.w*.422),cabY+.04,wz+.47,.045,.56,.055,vrTrim);}}
  vrBox(body,0,1.74,mid,s.w*.82,.1,len*.96,vrTrim);vrBox(body,0,.88,mid,s.w*.96,.09,len*.96,vrAmber);
 }else if(['van','minivan','delivery'].includes(type)){
   const len=s.l*(type==='delivery'?.76:.72),mid=-.02,cabY=type==='delivery'?1.32:1.18,cabH=type==='delivery'?1.42:1.18;vrPart(body,vrCabGeo,paint,0,cabY,mid,s.w*.94,cabH,len);
   vrGlassBox(body,0,cabY+.08,mid+len*.445+.012,s.w*.78,.62,.045,-.13);vrGlassBox(body,0,cabY+.05,mid-len*.445-.012,s.w*.74,.58,.045,.13);vrWindowStrip(body,s,mid,len,cabY+.02,.6);
  vrBox(body,0,cabY+cabH*.55,mid,s.w*.89,.1,len*.98,vrTrim);vrBox(body,0,.92,mid,s.w*.95,.08,len*.95,vrAmber);
 }else if(type==='pickup'){
  const cabLen=s.l*.4,cabMid=s.l*.13,cabY=1.1,cabH=.82;vrPart(body,vrCabGeo,paint,0,cabY,cabMid,s.w*.82,cabH,cabLen);vrGlassBox(body,0,cabY+.03,cabMid+cabLen*.445+.012,s.w*.7,cabH*.62,.045,-.24);vrWindowStrip(body,s,cabMid,cabLen,cabY,.42);vrBox(body,0,.79,-s.l*.29,s.w*.86,.42,s.l*.37,paint);vrBox(body,0,1.0,-s.l*.29,s.w*.72,.05,s.l*.29,vrTrim);vrBox(body,0,.86,s.l*.37,s.w*.8,.12,s.l*.17,paint);
 }else{
  const cabLen=type==='hatch'||type==='micro'?s.l*.58:type==='suv'||type==='wagon'?s.l*.6:type==='limo'?s.l*.55:type==='roadster'||type==='sports'?s.l*.42:s.l*.49,cabMid=type==='hatch'||type==='micro'?-.1:type==='wagon'?-.28:type==='limo'?-.32:type==='roadster'||type==='sports'?.02:-.16,cabY=1.04+s.h*.16,cabH=s.h*(type==='roadster'||type==='sports'?.58:.75);
  const hoodLen=type==='coupe'||type==='muscle'?.34:.3;vrBox(body,0,.87,s.l*.31,s.w*.82,.15,s.l*hoodLen,paint);vrBox(body,0,.86,-s.l*.35,s.w*.78,.13,s.l*.22,paint);
   vrPart(body,vrCabGeo,paint,0,cabY,cabMid,s.w*.81,cabH,cabLen);vrGlassBox(body,0,cabY+.03,cabMid+cabLen*.445+.012,s.w*.72,cabH*.67,.045,-.3);vrGlassBox(body,0,cabY+.02,cabMid-cabLen*.445-.012,s.w*.7,cabH*.62,.045,.25);vrWindowStrip(body,s,cabMid,cabLen,cabY,.48*cabH);
  vrBox(body,0,cabY+cabH*.55,cabMid,s.w*.84,.08,cabLen*.98,paint);vrBox(body,0,.83,0,s.w*.94,.06,s.l*.72,vrChrome);
  if(type==='coupe'||type==='muscle'){vrBox(body,0,.98,s.l*.33,.32,.025,s.l*.22,vrSeat);vrBox(body,0,1.02,-s.l*.39,s.w*.86,.08,.24,vrTrim);}
 }
  const lamps=[];vrDetails(body,s,type,paint);vrFenders(body,s);body.traverse(o=>{if(o.isMesh&&o.userData.lamp)lamps.push(o);});
 const wheels=[];vrWheels(g,s,wheels);
 let lights=null;if(type==='cop'||type==='suv'){const red=vrBox(body,-.42,1.17+s.h*.8,0,.62,.16,.34,vrPoliceRed);const blue=vrBox(body,.42,1.17+s.h*.8,0,.62,.16,.34,vrPoliceBlue);lights=[red,blue];}
 const v={id:nextId++,type,s,g,body,paint,lamps,wheels,lights,x,z,a,px:x,pz:z,pa:a,collisionPoints:[{x,z},{x,z},{x,z}],vx:0,vz:0,hp:s.hp,role,route,wp:0,desired:rand(12,18),echo:0,echoInput:null,input:{t:0,s:0,b:false},steer:0,history:[],credit:0,depth:0,hitCD:0,near:false,disabled:false,deadTime:0,swapLock:0,nav:0,navPath:[],lastNode:null,stuck:0};
 vehicles.push(v);syncVehicle(v,0);return v;
}
function removeVehicle(v){scene.remove(v.g);v.paint.dispose();const i=vehicles.indexOf(v);if(i>=0)vehicles.splice(i,1);}
function rectRoute(left,right,top,bottom,reverse=false){const p=[{x:left+4,z:bottom-4},{x:left+4,z:top+4},{x:right-4,z:top+4},{x:right-4,z:bottom-4}];return reverse?p.reverse():p;}
function spawnTraffic(anchor=player){
 if(vehicles.length>=76)return null;const near=anchor||{x:0,z:0},node=nodeNear(near.x,near.z);
 let li=clamp(node.i+Math.floor(rand(-3,1)),0,GRID_SECTORS-1),tj=clamp(node.j+Math.floor(rand(-3,1)),0,GRID_SECTORS-1);
 let ri=Math.min(GRID_SECTORS,li+1+Math.floor(rand(0,4))),bj=Math.min(GRID_SECTORS,tj+1+Math.floor(rand(0,4)));if(ri<=li)ri=Math.min(GRID_SECTORS,li+1);if(bj<=tj)bj=Math.min(GRID_SECTORS,tj+1);
 const route=rectRoute(roadLines[li],roadLines[ri],roadLines[tj],roadLines[bj],Math.random()<.5),n=Math.floor(rand(0,4)),from=route[n],to=route[(n+1)%4],t=Math.random(),x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
 const d0=Math.hypot(x-near.x,z-near.z);if(d0<14||d0>175||vehicles.some(v=>Math.hypot(v.x-x,v.z-z)<7))return null;
 const v=createVehicle(choice(TRAFFIC_TYPES),x,z,Math.atan2(to.x-from.x,to.z-from.z),'traffic',route);v.wp=(n+1)%4;v.vx=Math.sin(v.a)*v.desired;v.vz=Math.cos(v.a)*v.desired;return v;
}

const particleCount=420,particleMesh=new THREE.InstancedMesh(boxGeo,new THREE.MeshBasicMaterial({vertexColors:false}),particleCount);particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particleMesh.frustumCulled=false;scene.add(particleMesh);
const particles=Array.from({length:particleCount},()=>({life:0}));let particleCursor=0;
for(let i=0;i<particleCount;i++){dummy.position.set(0,-100,0);dummy.scale.setScalar(0);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);particleMesh.setColorAt(i,new THREE.Color());}
function burst(x,z,color,n=14,power=7,y=.6){for(let k=0;k<n;k++){const p=particles[particleCursor];p.x=x;p.y=y;p.z=z;p.vx=rand(-power,power);p.vz=rand(-power,power);p.vy=rand(2,power);p.life=p.total=rand(.3,.9);p.size=rand(.12,.37);p.spin=rand(-5,5);p.smoke=false;particleMesh.setColorAt(particleCursor,new THREE.Color(color));particleCursor=(particleCursor+1)%particleCount;}particleMesh.instanceColor.needsUpdate=true;}
function smoke(v,c='#9da7a0'){const p=particles[particleCursor];Object.assign(p,{x:v.x+rand(-.5,.5),y:1.2,z:v.z+rand(-.5,.5),vx:rand(-.6,.6),vz:rand(-.6,.6),vy:2.3,life:1.1,total:1.1,size:.45,spin:1,smoke:true});particleMesh.setColorAt(particleCursor,new THREE.Color(c));particleCursor=(particleCursor+1)%particleCount;particleMesh.instanceColor.needsUpdate=true;}
const skidGeo=new THREE.PlaneGeometry(.16,1.05),skidMat=new THREE.MeshBasicMaterial({color:'#223f45',transparent:true,opacity:.48,depthWrite:false});
const skidMesh=new THREE.InstancedMesh(skidGeo,skidMat,180);skidMesh.count=0;skidMesh.frustumCulled=false;skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(skidMesh);let skidIndex=0;
function skid(v){for(const side of [-1,1]){dummy.position.set(v.x+Math.cos(v.a)*side*v.s.w*.43,.075,v.z-Math.sin(v.a)*side*v.s.w*.43);dummy.rotation.set(-Math.PI/2,0,-v.a);dummy.scale.setScalar(1);dummy.updateMatrix();skidMesh.setMatrixAt(skidIndex++%180,dummy.matrix);}skidMesh.count=Math.min(180,skidIndex);skidMesh.instanceMatrix.needsUpdate=true;}
const ringGeo=new THREE.RingGeometry(2.8,3,40),ringMat=new THREE.MeshBasicMaterial({color:'#73fff0',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false});
const playerRing=new THREE.Mesh(ringGeo,ringMat);playerRing.rotation.x=-Math.PI/2;playerRing.material.depthTest=false;playerRing.renderOrder=5;scene.add(playerRing);
const targetRing=new THREE.Mesh(ringGeo,ringMat.clone());targetRing.rotation.x=-Math.PI/2;scene.add(targetRing);
const tetherArray=new Float32Array(39),tetherGeo=new THREE.BufferGeometry();tetherGeo.setAttribute('position',new THREE.BufferAttribute(tetherArray,3));
const tether=new THREE.Line(tetherGeo,new THREE.LineBasicMaterial({color:'#abfff0',transparent:true,opacity:.9,depthTest:false}));tether.frustumCulled=false;tether.renderOrder=10;scene.add(tether);
const waves=Array.from({length:5},()=>{const m=new THREE.Mesh(ringGeo,ringMat.clone());m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);return {m,life:0};});let waveIndex=0;
function wave(v){const w=waves[waveIndex++%waves.length];w.life=1;w.m.position.set(v.x,.15,v.z);w.m.visible=true;}

 let player=null,selected='coupe',state='title',elapsed=0,score=0,heat=0,wanted=1,peakWanted=1,arrest=0,spawnTimer=0,blockTimer=0,gameOverTimer=0,swapCooldown=0,swapTarget=null,swapProgress=0,swapHeldLatch=false,turboCharge=0,turboTime=0,shake=0,flash=0,callout=0,combo=0,comboTime=0,toastTimer=0,lastToastPriority=0,cameraMode='cockpit',cameraYaw=0;
let cityCullTick=0;const CITY_RENDER_RADIUS=245;
const FIXED_STEP=1/120;
let accumulator=0,renderAlpha=1,hudTick=0,shadowTick=0,shownWanted=0,fpsTime=0,fpsFrames=0;
 let stats={swaps:0,wrecks:0,distance:0,chain:0,turboUses:0},blocks=[],best=0,muted=false,simTime=0,keys={},particleTick=0,minimapTick=0;
 const fpsLabel=document.createElement('span');fpsLabel.className='smallButton';fpsLabel.textContent='— FPS';fpsLabel.title='Measured rendering rate · target 120 FPS';document.querySelector('.topTools').prepend(fpsLabel);
 const difficultySelect=document.createElement('select');difficultySelect.className='smallButton';difficultySelect.setAttribute('aria-label','Difficulty');difficultySelect.innerHTML='<option value="easy">EASY</option><option value="medium">MEDIUM</option><option value="hard">HARD</option>';difficultySelect.value=difficulty;document.querySelector('.topTools').prepend(difficultySelect);difficultySelect.onchange=()=>{if(state==='title'||confirm('Start a new chase with this difficulty?')){difficulty=difficultySelect.value;if(state!=='title'){resetRun();pause();}checkpoint();}else difficultySelect.value=difficulty;};
 const HISTORY_KEY='hotswap-history-v1',HISTORY_LIMIT=12;
 let historyRuns=[],storageWarning='',runPersisted=false;
 function cleanHistoryRun(run){if(!run||!Number.isFinite(Number(run.score)))return null;const n=(v,max)=>Math.max(0,Math.min(max,Math.floor(Number(v)||0)));return {score:n(run.score,999999999),elapsed:Math.max(0,Math.min(86400,Number(run.elapsed)||0)),swaps:n(run.swaps,999),wrecks:n(run.wrecks,9999),chain:n(run.chain,999),wanted:Math.max(1,Math.min(5,n(run.wanted,5))),date:typeof run.date==='string'?run.date:''};}
 function readPersistent(){try{best=Math.max(0,Math.floor(Number(archive.getItem('hotswap-best'))||0));const raw=archive.getItem(HISTORY_KEY);if(raw){let parsed;try{parsed=JSON.parse(raw);}catch{storageWarning='LOCAL ARCHIVE DATA INVALID · A NEW RUN WILL REPLACE IT';parsed=null;}const validShape=Array.isArray(parsed)||parsed&&parsed.version===1&&Array.isArray(parsed.runs);if(!validShape&&storageWarning==='')storageWarning='LOCAL ARCHIVE DATA INVALID · A NEW RUN WILL REPLACE IT';const values=Array.isArray(parsed)?parsed:validShape?parsed.runs:[];historyRuns=values.map(cleanHistoryRun).filter(Boolean).slice(0,HISTORY_LIMIT);for(const run of historyRuns)best=Math.max(best,run.score);}}catch{storageWarning='LOCAL SAVE UNAVAILABLE · SCORES STAY IN THIS TAB';}}
 function persistRun(){const run={score:Math.floor(score),elapsed:Number(elapsed.toFixed(1)),swaps:stats.swaps,wrecks:stats.wrecks,chain:stats.chain,wanted:peakWanted,date:new Date().toISOString()};historyRuns=[run,...historyRuns].slice(0,HISTORY_LIMIT);best=Math.max(best,run.score);try{archive.setItem('hotswap-best',String(best));archive.setItem(HISTORY_KEY,JSON.stringify({version:1,runs:historyRuns}));storageWarning='';}catch{storageWarning='LOCAL SAVE UNAVAILABLE · SCORES STAY IN THIS TAB';}runPersisted=true;archiveData.checkpoint=null;try{saveArchive();}catch(error){storageWarning='SAVE FAILED · '+error.message;}}
 function formatRunTime(seconds){const total=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');}
 function formatRunDate(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'DATE UNKNOWN';}
 function renderHistory(){const bestText='HIGHEST SCORE / '+best.toLocaleString();$('historyBest').textContent=bestText;if($('titleBest'))$('titleBest').textContent=bestText;$('historyStatus').textContent=storageWarning||'SAVED ON THIS DEVICE · LAST 12 RUNS';const list=$('historyList');list.replaceChildren();if(!historyRuns.length){const empty=document.createElement('li');empty.className='historyEmpty';empty.textContent='NO COMPLETED RUNS YET.';list.append(empty);return;}historyRuns.forEach((run,index)=>{const row=document.createElement('li');row.textContent=String(index+1).padStart(2,'0')+' · '+run.score.toLocaleString()+' PTS · '+formatRunTime(run.elapsed)+' · '+run.swaps+' SWAPS · '+run.wrecks+' WRECKS · '+formatRunDate(run.date);list.append(row);});}
 readPersistent();renderHistory();
const audio=new ChaseAudio();
function notify(main,sub='',priority=1){if(toastTimer>0&&priority<lastToastPriority)return;$('toast').firstElementChild.textContent=main;$('toast').lastElementChild.textContent=sub;$('toast').classList.add('show');toastTimer=2.8;lastToastPriority=priority;}
function resetRun(title=false){
 for(const v of [...vehicles])removeVehicle(v);for(const b of blocks)scene.remove(b.g);blocks=[];
 for(const p of particles){p.life=0;p.drawn=true;}skidMesh.count=0;skidIndex=0;for(const w of waves){w.life=0;w.m.visible=false;}
 accumulator=0;renderAlpha=1;hudTick=1;shadowTick=1;shownWanted=0;fpsTime=fpsFrames=0;fpsLabel.textContent='— FPS';
  elapsed=score=heat=arrest=simTime=swapCooldown=swapProgress=turboCharge=turboTime=shake=flash=callout=combo=comboTime=particleTick=0;wanted=peakWanted=1;spawnTimer=1.8;blockTimer=25;swapTarget=null;swapHeldLatch=false;stats={swaps:0,wrecks:0,distance:0,chain:0,turboUses:0};keys={};nextId=0;gameOverTimer=0;runPersisted=false;
 player=createVehicle(selected,4,25,Math.PI,'player',rectRoute(roadLines[8],roadLines[10],roadLines[6],roadLines[10]));player.wp=1;player.vz=-12;cameraYaw=player.a;setCameraMode(cameraMode);
 const early=createVehicle('taxi',-4,15,Math.PI,'traffic',[{x:-4,z:-54},{x:-54,z:-54},{x:-54,z:54},{x:-4,z:54}]);early.vz=-13;early.desired=13;
 createVehicle('van',4,-12,Math.PI,'traffic',rectRoute(roadLines[8],roadLines[9],roadLines[6],roadLines[10])).wp=1;
 createVehicle('truck',-54,-25,0,'traffic',rectRoute(roadLines[7],roadLines[9],roadLines[7],roadLines[10])).wp=0;
 for(let i=0;i<120&&vehicles.filter(v=>v.role==='traffic').length<42;i++)spawnTraffic(player);
 state=title?'title':'playing';$('title').classList.toggle('hidden',!title);$('hud').classList.toggle('hidden',title);$('results').classList.add('hidden');$('pause').classList.add('hidden');$('arrest').classList.add('hidden');$('targetLabel').classList.add('hidden');$('toast').classList.remove('show');toastTimer=0;lastToastPriority=0;$('damageEdge').style.opacity=0;visuals(0);
 if(!title){audio.start();audio.effect('start');notify('YOUR NEXT CAR IS ALREADY HERE.','Hold E near the highlighted taxi. Leave your momentum behind.',3);}
}
 function chargeTurbo(amount){if(state!=='playing'||turboTime>0||!Number.isFinite(amount))return;turboCharge=clamp(turboCharge+amount,0,100);}
 function activateTurbo(){if(state!=='playing'||!player||player.disabled||turboTime>0||turboCharge<100)return false;turboCharge=0;turboTime=3.4;stats.turboUses++;flash=.42;shake=.16;callout=.8;$('callout').textContent='TURBO';audio.effect('turbo');notify('TURBO ENGAGED','3.4 seconds · charge paused while boosting.',4);return true;}
 function clearKeys(){keys={};accumulator=0;fpsTime=fpsFrames=0;}
function pause(){if(state==='playing'){state='paused';clearKeys();$('pause').classList.remove('hidden');audio.update(0,0,0,false);checkpoint();}}
function resume(){if(state==='paused'){state='playing';clearKeys();$('pause').classList.add('hidden');audio.start();}}
function input(){return {t:(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),s:(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0),b:!!keys.Space};}
 window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','ShiftLeft','ShiftRight','KeyV'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){if(!$('historyDialog').classList.contains('hidden')){$('historyDialog').classList.add('hidden');return;}state==='paused'?resume():pause();return;}if(e.code==='KeyH'){if(state==='title'||state==='over'){$('historyDialog').classList.contains('hidden')?($('historyDialog').classList.remove('hidden'),renderHistory()):$('historyDialog').classList.add('hidden');}return;}if(e.code==='KeyM'){toggleMute();return;}if(e.code==='KeyV'){setCameraMode();checkpoint();return;}if(e.code==='ShiftLeft'||e.code==='ShiftRight'){activateTurbo();return;}keys[e.code]=true;});
window.addEventListener('keyup',e=>{delete keys[e.code];if(e.code==='KeyE')swapHeldLatch=false;});window.addEventListener('blur',()=>{clearKeys();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearKeys();pause();}});
function toggleMute(){muted=!muted;audio.setMuted(muted);$('mute').textContent=muted?'SOUND OFF · M':'SOUND ON · M';$('mute').setAttribute('aria-pressed',String(muted));checkpoint();}
function setCameraMode(mode=cameraMode==='cockpit'?'chase':'cockpit'){
 cameraMode=mode==='chase'?'chase':'cockpit';
 const chase=cameraMode==='chase';
 cockpit.visible=!chase;cockpitInterior.visible=!chase;cockpitExterior.visible=!chase;
 camera.fov=chase?72:74;camera.updateProjectionMatrix();
 $('viewMode').textContent=(chase?'CHASE':'COCKPIT')+' · V';
}
 $('mute').onclick=toggleMute;$('viewMode').onclick=()=>{setCameraMode();checkpoint();};$('pauseBtn').onclick=pause;$('resume').onclick=resume;$('start').onclick=()=>{resetRun();checkpoint();};$('again').onclick=()=>{resetRun();checkpoint();};$('change').onclick=()=>{archiveData.checkpoint=null;saveArchive();resetRun(true);};$('historyBtn').onclick=()=>{$('title').classList.remove('hidden');renderHistory();$('historyDialog').classList.remove('hidden');};$('resultsHistory').onclick=()=>{renderHistory();$('historyDialog').classList.remove('hidden');};$('closeHistory').onclick=()=>{$('historyDialog').classList.add('hidden');};
document.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>{selected=b.dataset.car;document.querySelectorAll('[data-car]').forEach(q=>q.setAttribute('aria-pressed',String(q===b)));resetRun(true);checkpoint();});

function clearPath(ax,az,bx,bz,pad=1.3){const dx=bx-ax,dz=bz-az;for(const b of solids){if(Math.max(ax,bx)<b.x-b.w-pad||Math.min(ax,bx)>b.x+b.w+pad||Math.max(az,bz)<b.z-b.d-pad||Math.min(az,bz)>b.z+b.d+pad)continue;let lo=0,hi=1;for(const [p,d,min,max] of [[ax,dx,b.x-b.w-pad,b.x+b.w+pad],[az,dz,b.z-b.d-pad,b.z+b.d+pad]]){if(Math.abs(d)<1e-7){if(p<min||p>max){lo=2;break;}}else{let t1=(min-p)/d,t2=(max-p)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);}}if(lo<=hi)return false;}return true;}
function nodeNear(x,z){let i=0,j=0;for(let k=1;k<roadLines.length;k++){if(Math.abs(roadLines[k]-x)<Math.abs(roadLines[i]-x))i=k;if(Math.abs(roadLines[k]-z)<Math.abs(roadLines[j]-z))j=k;}return {i,j,x:roadLines[i],z:roadLines[j]};}
function policePath(v,tx,tz){const n=nodeNear(v.x,v.z),end=nodeNear(tx,tz),p=[];let i=n.i,j=n.j;p.push({x:roadLines[i],z:roadLines[j]});for(let guard=0;guard<roadLines.length*2&&(i!==end.i||j!==end.j);guard++){if((Math.abs(end.i-i)>=Math.abs(end.j-j)&&i!==end.i)||j===end.j)i+=Math.sign(end.i-i);else j+=Math.sign(end.j-j);p.push({x:roadLines[i],z:roadLines[j]});}p.push({x:tx,z:tz});return p;}
function driveTo(v,tx,tz,speed){const dx=tx-v.x,dz=tz-v.z;if(dx*dx+dz*dz<.01)return {t:0,s:0,b:false};const angle=wrap(Math.atan2(dx,dz)-v.a),forward=v.vx*Math.sin(v.a)+v.vz*Math.cos(v.a),target=speed*(Math.abs(angle)>.8?.48:1);return {t:clamp((target-forward)*.5,-1,1),s:clamp(angle*1.9,-1,1),b:false};}
function ai(v,dt){
 if(v.disabled){if(v.role==='echo'){v.echo-=dt;if(v.echo<=0)v.role='abandoned';}return {t:0,s:0,b:false};}
 if(v.role==='echo'){v.echo-=dt;if(v.echo<=0){v.role='abandoned';return {t:0,s:0,b:false};}return v.echoInput;}
 if(v.role==='abandoned')return {t:0,s:0,b:false};
 if(v.role==='block'){if(dist(v,player)>27)return {t:0,s:0,b:true};v.role='cop';}
 if(v.role==='cop'||v.role==='block'){
  v.nav-=dt;const prediction=wanted>=3?clamp(dist(v,player)/30,0,1.7):.25,side=wanted>=2?(v.id%3-1)*4:0,tx=clamp(player.x+player.vx*prediction+Math.cos(player.a)*side,WORLD_MIN+4,WORLD_MAX-4),tz=clamp(player.z+player.vz*prediction-Math.sin(player.a)*side,WORLD_MIN+4,WORLD_MAX-4);
  let target={x:tx,z:tz};if(!clearPath(v.x,v.z,tx,tz,2)){if(v.nav<=0||!v.navPath.length){v.navPath=policePath(v,tx,tz);v.nav=.9;}while(v.navPath.length>1&&Math.hypot(v.x-v.navPath[0].x,v.z-v.navPath[0].z)<7)v.navPath.shift();target=v.navPath[0]||target;}
  const c=driveTo(v,target.x,target.z,Math.min(v.s.max,23+wanted*2));if(Math.hypot(v.vx,v.vz)<2)v.stuck+=dt;else v.stuck=Math.max(0,v.stuck-dt*2);if(v.stuck>1.8){c.t=-1;c.s=(v.id%2?1:-1);if(v.stuck>3)v.stuck=0;}return c;
 }
 if(!v.route)return {t:0,s:0,b:false};let target=v.route[v.wp];if(Math.hypot(v.x-target.x,v.z-target.z)<5){v.wp=(v.wp+1)%v.route.length;target=v.route[v.wp];}
 let speed=v.desired;if(Math.hypot(target.x-v.x,target.z-v.z)<13)speed*=.7;
 const sin=Math.sin(v.a),cos=Math.cos(v.a);for(const o of vehicles){if(o===v)continue;const dx=o.x-v.x,dz=o.z-v.z,along=dx*sin+dz*cos,across=dx*cos-dz*sin;if(along>0&&along<8&&Math.abs(across)<2.1&&o.role==='traffic')speed=Math.min(speed,Math.max(0,(along-4)*3));}
 const c=driveTo(v,target.x,target.z,speed);if(Math.hypot(v.vx,v.vz)<.8)v.stuck+=dt;else v.stuck=0;if(v.stuck>3&&v.stuck<4.2){c.t=-.7;c.s=.6;}if(v.stuck>=4.2)v.stuck=0;return c;
}
function integrate(v,c,dt){
 v.hitCD=Math.max(0,v.hitCD-dt);v.swapLock=Math.max(0,v.swapLock-dt);v.credit=Math.max(0,v.credit-dt);v.input=c;
 const sx=Math.sin(v.a),cz=Math.cos(v.a);let f=v.vx*sx+v.vz*cz,l=v.vx*cz-v.vz*sx;
  const turboActive=v===player&&turboTime>0&&state==='playing';
  if(!v.disabled){let force=c.t*v.s.acc*(turboActive?1.65:1);if(c.t<0&&f>1)force=c.t*37;f+=force*dt;f*=Math.exp(-(c.b?2.3:.21)*dt);f=clamp(f,-10,v.s.max+(turboActive?9:0));l*=Math.exp(-(c.b?1.7:v.s.grip)*dt);const steerTarget=c.s*clamp(Math.abs(f)/Math.max(v.s.max*.35,1),0,1);v.steer+=(steerTarget-v.steer)*(1-Math.exp(-dt*(c.b?15:11)));const speedFactor=clamp(Math.abs(f)/Math.max(v.s.max*.28,1),0,1);v.a=wrap(v.a+v.steer*v.s.turn*speedFactor*Math.sign(f||1)*(c.b?1.14:1)*dt);}else{f*=Math.exp(-1.35*dt);l*=Math.exp(-1.35*dt);v.steer*=Math.exp(-dt*12);v.deadTime+=dt;}
 const s2=Math.sin(v.a),c2=Math.cos(v.a);v.vx=s2*f+c2*l;v.vz=c2*f-s2*l;v.x+=v.vx*dt;v.z+=v.vz*dt;
 for(const axis of ['x','z']){if(Math.abs(v[axis])>WORLD_EDGE){v[axis]=clamp(v[axis],-WORLD_EDGE,WORLD_EDGE);const vel=axis==='x'?'vx':'vz';if(Math.abs(v[vel])>6)damage(v,Math.abs(v[vel])*.6,null);v[vel]*=-.35;}}
 if(v===player&&state==='playing'){stats.distance+=Math.hypot(v.vx,v.vz)*dt;v.history.push({t:c.t,s:c.s,b:c.b});if(v.history.length>40)v.history.shift();}
}
function circles(v){const s=Math.sin(v.a)*v.s.l*.28,c=Math.cos(v.a)*v.s.l*.28,p=v.collisionPoints;for(let i=0;i<3;i++){p[i].x=v.x+(i-1)*s;p[i].z=v.z+(i-1)*c;}return p;}
function damage(v,amount,source){if(v.disabled||amount<=0)return;v.hp=Math.max(0,v.hp-amount);if(v===player){shake=Math.min(.9,shake+amount*.012);flash=Math.max(flash,.08);}if(v.hp<=0)disable(v,source);}
function award(points,text,depth=1){if(state!=='playing')return;comboTime=5;combo=Math.min(8,combo+1);stats.chain=Math.max(stats.chain,depth);score+=Math.round(points*(1+Math.min(combo-1,7)*.2));if(text)notify(text,`+${Math.round(points*(1+Math.min(combo-1,7)*.2))} / CHAIN ×${Math.max(depth,1)}`,depth>1?3:1);}
function disable(v,source){if(v.disabled)return;v.disabled=true;v.hp=0;burst(v.x,v.z,'#ffe399',32,10,1);burst(v.x,v.z,'#ff947b',18,7,.8);audio.effect('wreck');wave(v);
 const credited=v.credit>0||source&&(source===player||source.credit>0);if(v!==player&&credited&&state==='playing'){stats.wrecks++;heat+=3;chargeTurbo(8);award(300,v.depth>1?'CHAIN REACTION!':'VEHICLE WRECKED',Math.max(1,v.depth));}
 if(v===player){endRun('VEHICLE TOTALLED');return;}
 for(const o of vehicles){if(o===v||o.disabled)continue;const d=dist(v,o);if(d>0.1&&d<7){const power=(1-d/7)*10;o.vx+=(o.x-v.x)/d*power;o.vz+=(o.z-v.z)/d*power;if(credited&&o!==player&&o.credit<=0){o.credit=5;o.depth=Math.min(8,v.depth+1);}damage(o,power*2.7,v);}}
}
function collideWorld(v){const r=v.s.w*.48;for(let bi=0;bi<solids.length+blocks.length*4;bi++){const k=bi-solids.length,b=k<0?solids[bi]:blocks[Math.floor(k/4)].solids[k%4];if(Math.abs(v.x-b.x)>b.w+v.s.l||Math.abs(v.z-b.z)>b.d+v.s.l)continue;for(const p of circles(v)){const qx=clamp(p.x,b.x-b.w,b.x+b.w),qz=clamp(p.z,b.z-b.d,b.z+b.d);let dx=p.x-qx,dz=p.z-qz,d=Math.hypot(dx,dz),pen=r-d;
  if(pen<=0)continue;if(d<1e-6){const px=b.w+r-Math.abs(p.x-b.x),pz=b.d+r-Math.abs(p.z-b.z);if(px<pz){dx=p.x>=b.x?1:-1;dz=0;pen=px;}else{dx=0;dz=p.z>=b.z?1:-1;pen=pz;}d=1;}
  const nx=dx/d,nz=dz/d;v.x+=nx*pen;v.z+=nz*pen;const impact=-(v.vx*nx+v.vz*nz);if(impact>0){v.vx+=nx*impact*1.3;v.vz+=nz*impact*1.3;if(impact>4&&v.hitCD<=0){damage(v,(impact-3)*1.1,null);v.hitCD=.28;if(dist(v,player)<45){burst(p.x,p.z,'#f5dc9d',8,4);audio.effect('hit');}}}
 }} }
function collideCars(a,b){if(Math.abs(a.x-b.x)>(a.s.l+b.s.l)*.6||Math.abs(a.z-b.z)>(a.s.l+b.s.l)*.6)return;let deepest=null;const r=(a.s.w+b.s.w)*.49;
 const ac=circles(a),bc=circles(b);for(const p of ac)for(const q of bc){const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);if(d<r&&(!deepest||r-d>deepest.pen))deepest={nx:d>1e-6?dx/d:1,nz:d>1e-6?dz/d:0,pen:r-d};}
 if(!deepest)return;const {nx,nz,pen}=deepest,ia=1/a.s.mass,ib=1/b.s.mass,sum=ia+ib;a.x-=nx*pen*ia/sum*.8;a.z-=nz*pen*ia/sum*.8;b.x+=nx*pen*ib/sum*.8;b.z+=nz*pen*ib/sum*.8;
 const impact=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;if(impact<=0)return;const impulse=impact*1.36/sum;a.vx-=nx*impulse*ia;a.vz-=nz*impulse*ia;b.vx+=nx*impulse*ib;b.vz+=nz*impulse*ib;
 if(impact>4&&(a.hitCD<=0||b.hitCD<=0)){
  const ca=a===player||a.credit>0,cb=b===player||b.credit>0;
  if(ca&&b!==player&&b.credit<=0){b.credit=5;b.depth=Math.min(8,a.depth+1);}if(cb&&a!==player&&a.credit<=0){a.credit=5;a.depth=Math.min(8,b.depth+1);}
  if(a.hitCD<=0)damage(a,(impact-2)*1.8*b.s.mass/Math.sqrt(a.s.mass),b);if(b.hitCD<=0)damage(b,(impact-2)*1.8*a.s.mass/Math.sqrt(b.s.mass),a);a.hitCD=b.hitCD=.3;
  if(dist(a,player)<45){burst((a.x+b.x)/2,(a.z+b.z)/2,'#ffe5a7',14,Math.min(10,impact));audio.effect('hit');}
   if(ca||cb){heat+=.6;const echo=a.role==='echo'||b.role==='echo'||((ca||cb)&&a!==player&&b!==player);if(echo)chargeTurbo(8);award(echo?160:45,echo?'MOMENTUM ECHO HIT':null,Math.max(a.depth,b.depth,1));}
 }
}
function onScreen(x,z,margin=1.18){const p=V(x,1,z).project(camera);return p.z>=-1&&p.z<=1&&Math.abs(p.x)<margin&&Math.abs(p.y)<margin&&clearPath(camera.position.x,camera.position.z,x,z,0);}
function spawnPolice(){if(vehicles.filter(v=>v.role==='cop'||v.role==='block').length>=Math.min(10,2+wanted*2)||vehicles.length>=64)return;
 const candidates=[];for(const r of roadLines)for(let p=WORLD_MIN;p<=WORLD_MAX;p+=SECTOR/2){for(const point of [{x:r+4,z:p},{x:p,z:r-4}]){const d=dist(point,player);if(d>72&&d<140&&!onScreen(point.x,point.z)&&!vehicles.some(v=>dist(v,point)<9))candidates.push(point);}}
 if(!candidates.length)return;const p=choice(candidates),v=createVehicle(wanted>=3&&Math.random()<.38?'suv':'cop',p.x,p.z,Math.atan2(player.x-p.x,player.z-p.z),'cop');v.vx=Math.sin(v.a)*20;v.vz=Math.cos(v.a)*20;
}
function spawnBlock(){if(blocks.length>=2||vehicles.length>62)return;const sx=Math.sin(player.a),cz=Math.cos(player.a);const options=sites.filter(s=>{const dx=s.x-player.x,dz=s.z-player.z,d=Math.hypot(dx,dz);return d>62&&d<145&&dx*sx+dz*cz>25&&!onScreen(s.x,s.z,1.28)&&!blocks.some(b=>dist(b,s)<45)&&!vehicles.some(v=>dist(v,s)<12);}).sort((a,b)=>dist(a,player)-dist(b,player));if(!options.length)return;
 const s=options[0],g=new THREE.Group();scene.add(g);g.position.set(s.x,0,s.z);if(s.axis==='x')g.rotation.y=Math.PI/2;
 for(let k=-2;k<=1;k++){box(g,k*3,.58,0,2.4,1,.65,k%2?'#f5d482':'#dd847c');box(g,k*3,.99,0,2.42,.16,.68,'#f4edca');}
 const barriers=[];for(let k=-2;k<=1;k++)barriers.push({x:s.x+(s.axis==='z'?k*3:0),z:s.z+(s.axis==='x'?-k*3:0),w:s.axis==='z'?1.2:.325,d:s.axis==='z'?.325:1.2});
 const b={...s,g,life:0,cars:[],solids:barriers};blocks.push(b);
 for(const side of [-1,1]){const v=createVehicle(wanted>=4?'suv':'cop',s.x+(s.axis==='z'?side*4:3.5),s.z+(s.axis==='x'?side*4:3.5),s.axis==='z'?Math.PI/2:0,'block');v.nav=0;b.cars.push(v);}
 notify('ROADBLOCK AHEAD','Dispatch is closing the grid. Find a gap — or a new ride.',4);audio.effect('wanted');
}
function validTarget(v,loose=false){if(!v||v===player||v.disabled||v.swapLock>0||v.role==='echo'||v.role==='cop'||v.role==='block'||POLICE_TYPES.has(v.type))return false;const dx=v.x-player.x,dz=v.z-player.z,d=Math.hypot(dx,dz);if(d<.1||d>(loose?25:22))return false;const front=(dx*Math.sin(player.a)+dz*Math.cos(player.a))/d,heading=Math.cos(v.a-player.a);return front>(loose?-.6:-.4)&&heading>-.35&&clearPath(player.x,player.z,v.x,v.z,.3);}
function swapUpdate(realDt){swapCooldown=Math.max(0,swapCooldown-realDt);if(!keys.KeyE)swapHeldLatch=false;
 if(!swapTarget||swapProgress===0&&!keys.KeyE){let bestV=null,bestD=Infinity;for(const v of vehicles){if(validTarget(v)){const d=dist(v,player);if(d<bestD){bestD=d;bestV=v;}}}swapTarget=bestV;}
 const valid=validTarget(swapTarget,true);if(keys.KeyE&&!swapHeldLatch&&swapCooldown===0&&valid){swapProgress=Math.min(1,swapProgress+realDt/ .85);if(swapProgress>=1)transfer();}else{swapProgress=Math.max(0,swapProgress-realDt*1.8);if(!valid&&swapProgress===0)swapTarget=null;}
}
function transfer(){const old=player,target=swapTarget;if(!validTarget(target,true))return;const hist=old.history.length?old.history:[old.input],n=hist.length;old.echoInput={t:hist.reduce((s,i)=>s+i.t,0)/n,s:hist.reduce((s,i)=>s+i.s,0)/n,b:hist.filter(i=>i.b).length>n/2};old.echo=2.6;old.role='echo';old.credit=7;old.depth=0;old.swapLock=4;old.history=[];
  player=target;player.role='player';player.credit=0;player.depth=0;player.hitCD=.5;player.swapLock=0;player.history=[];cameraYaw=player.a;arrest=Math.max(0,arrest-1.4);swapTarget=null;swapProgress=0;swapCooldown=1.6;swapHeldLatch=true;turboTime=0;stats.swaps++;heat+=2;chargeTurbo(20);award(120);wave(old);wave(player);burst(old.x,old.z,'#73fff0',24,8);burst(player.x,player.z,'#dfff8b',24,8);flash=.62;callout=1;$('callout').textContent='HOTSWAP';shake=.24;audio.effect('swap');notify('MOMENTUM ECHO','Your old ride has 2.6 seconds of unfinished business.',3);}
function endRun(reason){if(state!=='playing')return;state='ending';gameOverTimer=0;clearKeys();swapTarget=null;swapProgress=0;$('resultReason').textContent=reason;notify(reason,'THE CITY ALWAYS GETS THE LAST WORD.',5);audio.effect('wreck');}
 function showResults(){if(state==='over')return;state='over';if(!runPersisted)persistRun();$('finalScore').textContent=Math.floor(score).toLocaleString();$('bestScore').textContent='PERSONAL BEST / '+best.toLocaleString();$('saveStatus').textContent=storageWarning||'LOCAL ARCHIVE UPDATED';$('statTime').textContent=Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0');$('statSwaps').textContent=stats.swaps;$('statWrecks').textContent=stats.wrecks;$('statChain').textContent='×'+stats.chain;$('statDistance').textContent=Math.round(stats.distance).toLocaleString();$('statWanted').textContent=peakWanted+' / 5';$('results').classList.remove('hidden');$('hud').classList.add('hidden');$('arrest').classList.add('hidden');$('targetLabel').classList.add('hidden');$('toast').classList.remove('show');}

function simulation(dt){simTime+=dt;particleTick+=dt;
 for(const v of vehicles){v.px=v.x;v.pz=v.z;v.pa=v.a;}
 for(const v of vehicles){let c;if(v===player){c=state==='playing'?input():state==='title'?ai(v,dt):{t:0,s:0,b:false};}else c=ai(v,dt);integrate(v,c,dt);collideWorld(v);}
 for(let i=0;i<vehicles.length;i++)for(let j=i+1;j<vehicles.length;j++)collideCars(vehicles[i],vehicles[j]);
 if(particleTick>.065){particleTick=0;for(const v of vehicles){const near=dist(v,player)<65;if(!near)continue;if(v.disabled||v.hp/v.s.hp<.35)smoke(v);if(v.role==='echo'){smoke(v,'#6cebd7');if(Math.random()<.4)burst(v.x,v.z,'#a4fff1',2,1,.3);}if((v.input.b||Math.abs(v.input.s)>.7)&&Math.hypot(v.vx,v.vz)>12)skid(v);}}
  if(state!=='playing')return;
  const playerSpeed=Math.hypot(player.vx,player.vz);if(turboTime>0)turboTime=Math.max(0,turboTime-dt);else if(playerSpeed>15)chargeTurbo(dt*(playerSpeed-15)/20*5.5);
  elapsed+=dt;score+=playerSpeed*dt*.38;comboTime-=dt;if(comboTime<=0)combo=0;
 const next=Math.min(5,1+Math.floor((elapsed/19+heat/22)*({easy:.6,medium:1,hard:1.4}[difficulty])));if(next>wanted){wanted=peakWanted=next;notify(wanted===3?'INTERCEPT UNITS INBOUND':wanted===5?'THE WHOLE CITY WANTS YOU':'PURSUIT ESCALATING',wanted===2?'Patrols are coordinating. Roadblocks authorized.':wanted===3?'Heavy units. Predictive pursuit. Fewer places to hide.':'More units have joined the chase.',4);audio.effect('wanted');spawnTimer=0;}
 spawnTimer-=dt;if(spawnTimer<=0){spawnPolice();spawnTimer=Math.max(2.2,5.5-wanted*.65)*({easy:1.4,medium:1,hard:.75}[difficulty]);}
 blockTimer-=dt;if(wanted>=2&&blockTimer<=0){spawnBlock();blockTimer=blocks.length?20:2;}
  let closest=Infinity;for(const v of vehicles){if(v.disabled)continue;if(v.role==='cop'||v.role==='block')closest=Math.min(closest,dist(v,player));if(v!==player&&v.role==='traffic'){const d=dist(v,player);if(d<4.5&&d>2.7&&playerSpeed>21&&!v.near&&v.hitCD<=0){v.near=true;chargeTurbo(12);award(40,'NEAR MISS');}if(d>12)v.near=false;}}
 arrest=clamp(arrest+(closest<8.5&&Math.hypot(player.vx,player.vz)<4?dt:-dt*1.5),0,3.5);if(arrest>=3.5)endRun('BUSTED / BOXED IN');
 for(const v of [...vehicles]){if(v===player||v===swapTarget||v.role==='echo')continue;const far=dist(v,player)>135;if(far&&!onScreen(v.x,v.z)&&(v.disabled||v.role==='abandoned'||v.role==='traffic'&&dist(v,player)>195||v.role==='cop'&&dist(v,player)>190)){removeVehicle(v);}}
 if(vehicles.filter(v=>v.role==='traffic').length<42&&Math.random()<dt*4){const v=spawnTraffic(player);if(v&&onScreen(v.x,v.z))removeVehicle(v);}
 for(let i=blocks.length-1;i>=0;i--){blocks[i].life+=dt;if(blocks[i].life>25&&dist(blocks[i],player)>100){for(const v of blocks[i].cars)if(v.role==='block')removeVehicle(v);scene.remove(blocks[i].g);blocks.splice(i,1);}}
}
function syncVehicle(v,dt){v.g.position.set(THREE.MathUtils.lerp(v.px,v.x,renderAlpha),0,THREE.MathUtils.lerp(v.pz,v.z,renderAlpha));v.g.rotation.y=v.pa+wrap(v.a-v.pa)*renderAlpha;const showPlayer=v===player&&cameraMode==='chase';v.g.visible=(v!==player||showPlayer)&&(!player||v===player||dist(v,player)<135);const speed=Math.hypot(v.vx,v.vz);v.body.rotation.z=THREE.MathUtils.lerp(v.body.rotation.z,v.disabled?.13:-v.input.s*Math.min(speed/30,1)*.065,Math.min(1,dt*10));v.body.rotation.x=THREE.MathUtils.lerp(v.body.rotation.x,-v.input.t*.035,Math.min(1,dt*10));v.body.position.y=v.disabled?-.12:Math.sin(simTime*14+v.id)*Math.min(speed*.0007,.025);v.paint.color.set(v.disabled?'#647875':v.paint.userData.original||v.paint.color);if(!v.paint.userData.original)v.paint.userData.original=v.paint.color.clone();
 if(!v.disabled&&v.hp/v.s.hp<.4)v.paint.color.copy(v.paint.userData.original).multiplyScalar(.7);v.paint.emissive.set(v.role==='echo'&&!v.disabled?'#2a8e79':'#000000');
 if(v.lights){const active=(v.role==='cop'||v.role==='block')&&!v.disabled;v.lights[0].visible=active&&Math.sin(simTime*19+v.id)>-.1;v.lights[1].visible=active&&!v.lights[0].visible;}
}
function updateParticles(dt){let changed=false;for(let i=0;i<particles.length;i++){const p=particles[i];if(p.life<=0&&!p.drawn)continue;if(p.life>0){p.drawn=true;p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=p.smoke?0:15*dt;if(p.y<.1){p.y=.1;p.vy=Math.abs(p.vy)*.3;}const ratio=clamp(p.life/p.total,0,1);dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.size*(p.smoke?(2-ratio)*ratio:Math.min(1,ratio*3)));dummy.rotation.set(p.spin*p.life,p.life*2,p.life);}else{p.drawn=false;dummy.position.set(0,-100,0);dummy.scale.setScalar(0);}dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);changed=true;}if(changed)particleMesh.instanceMatrix.needsUpdate=true;
 for(const w of waves){if(w.life>0){w.life-=dt*1.5;w.m.visible=w.life>0;w.m.scale.setScalar(1+(1-w.life)*5);w.m.material.opacity=Math.max(0,w.life*.7);}}
}
const mapCtx=$('map').getContext('2d');
function drawMap(){const c=mapCtx,w=264,scale=.64;c.clearRect(0,0,w,w);c.fillStyle='#122f39';c.fillRect(0,0,w,w);c.save();c.translate(w/2,w/2);c.scale(scale,scale);c.translate(-player.x,-player.z);c.strokeStyle='#48636a';c.lineWidth=10;c.beginPath();for(const r of roadLines){c.moveTo(WORLD_MIN-20,r);c.lineTo(WORLD_MAX+20,r);c.moveTo(r,WORLD_MIN-20);c.lineTo(r,WORLD_MAX+20);}c.stroke();for(const b of blocks){c.fillStyle='#ffc777';c.fillRect(b.x-5,b.z-5,10,10);}for(const v of vehicles){if(v===player||v.disabled)continue;c.fillStyle=v.role==='cop'||v.role==='block'?'#ff7382':v.role==='echo'?'#70ffe1':'#b1c4ae';c.beginPath();c.arc(v.x,v.z,v.role==='cop'?3.8:2.3,0,TAU);c.fill();}c.translate(player.x,player.z);c.rotate(-player.a);c.fillStyle='#e4ff74';c.beginPath();c.moveTo(0,8);c.lineTo(-5,-5);c.lineTo(5,-5);c.closePath();c.fill();c.restore();c.fillStyle='#c9dec9';c.font='14px monospace';c.fillText('N',12,22);}
function hud(dt){$('score').textContent=String(Math.floor(score)).padStart(6,'0');$('combo').textContent=combo>1?'×'+(1+Math.min(combo-1,7)*.2).toFixed(1)+' CHAOS MULTIPLIER':'MAKE AN IMPRESSION.';if(shownWanted!==wanted){shownWanted=wanted;$('stars').innerHTML=Array.from({length:5},(_,i)=>'<span class="'+(i<wanted?'on':'')+'">★</span>').join('');$('pursuitText').textContent=['PATROL UNITS DEPLOYED','ROADBLOCKS AUTHORIZED','INTERCEPT TEAMS ACTIVE','HEAVY UNITS IN PURSUIT','CITYWIDE LOCKDOWN'][wanted-1];}$('carName').textContent=player.s.name;const hp=clamp(player.hp/player.s.hp*100,0,100);$('health').style.width=hp+'%';$('health').style.background=hp<30?'var(--red)':'var(--cyan)';$('healthText').textContent=Math.ceil(hp)+'%';$('speed').textContent=String(Math.round(Math.hypot(player.vx,player.vz)*3.6)).padStart(2,'0');$('swapProgress').style.width=swapProgress*100+'%';
  $('swapTitle').textContent=swapCooldown>0?'SIGNAL RECHARGING':swapProgress>0?'TRANSFERRING…':swapTarget?'HOLD TO HOTSWAP':'FIND YOUR NEXT RIDE';$('swapInfo').textContent=swapCooldown>0?'READY IN '+swapCooldown.toFixed(1)+'s':swapTarget?swapTarget.s.name+' / '+Math.round(dist(player,swapTarget))+' M / '+Math.round(swapTarget.hp/swapTarget.s.hp*100)+'% BODY':'GET CLOSE · FACE THE SAME DIRECTION';const turboReady=turboCharge>=100&&!turboTime;const turboPct=turboTime>0?100:Math.floor(turboCharge);$('turboValue').textContent=turboTime>0?'BOOST '+turboTime.toFixed(1)+'s':turboPct+'%';$('turboProgress').style.width=turboPct+'%';$('turboProgress').classList.toggle('ready',turboReady);$('turboHint').textContent=turboTime>0?'BOOST ACTIVE · CHARGE PAUSED':turboReady?'SHIFT TO ACTIVATE':'SPEED · NEAR MISSES · SWAPS';
 $('arrest').classList.toggle('hidden',arrest<.15||state!=='playing');$('arrest').querySelector('i').style.width=arrest/3.5*100+'%';$('damageEdge').style.opacity=state==='playing'?Math.max(0,(.35-hp/100)*1.5)+(arrest/3.5)*.2:0;
 minimapTick+=dt;if(minimapTick>.12){drawMap();minimapTick=0;}
}
function updateCityChunkVisibility(dt,force=false){
 if(!player)return;cityCullTick+=dt;if(!force&&cityCullTick<.15)return;cityCullTick=0;
 const px=player.x,pz=player.z,r2=CITY_RENDER_RADIUS*CITY_RENDER_RADIUS;
 for(const chunk of cityChunks){const dx=chunk.userData.chunkX-px,dz=chunk.userData.chunkZ-pz;chunk.visible=dx*dx+dz*dz<=r2;}
}
function visuals(dt){updateCityChunkVisibility(dt,dt===0);for(const v of vehicles)syncVehicle(v,dt);const running=state==='playing'||state==='ending';
 const speed=Math.hypot(player.vx,player.vz),rawA=player.g.rotation.y,pos=player.g.position;
 const yawDelta=wrap(rawA-cameraYaw),yawResponse=1-Math.exp(-dt*(speed<8?18:12));cameraYaw=wrap(cameraYaw+yawDelta*yawResponse);
 const sx=Math.sin(cameraYaw),cz=Math.cos(cameraYaw),rx=Math.cos(cameraYaw),rz=-Math.sin(cameraYaw),chase=cameraMode==='chase';
 const shakeJitter=clamp(shake,0,.9)*.014*(Math.random()-.5);
 if(chase){
  // Proper trailing camera: far enough back to frame the whole vehicle and enough height
  // to read its roof/body shape without making the car dominate the screen.
  const chaseDistance=clamp(9.8+player.s.l*.55,10.5,13.5),chaseHeight=4.7+player.s.h*.55;
  const lateral=clamp(player.steer,-1,1)*-.38,lookAhead=4.5+Math.min(speed*.08,2.4);
  camera.position.set(pos.x-sx*chaseDistance+rx*lateral,pos.y+chaseHeight+shakeJitter,pos.z-cz*chaseDistance+rz*lateral);
  camera.lookAt(pos.x+sx*lookAhead,pos.y+1.05+player.s.h*.28,pos.z+cz*lookAhead);
  cockpit.visible=false;
 }else{
  const eye=1.28+player.s.h*.28,forwardOffset=.02,sideOffset=-.38;
  const bob=Math.sin(simTime*(9+speed*.08))*Math.min(speed*.0012,.016);
  camera.position.set(pos.x+sx*forwardOffset+rx*sideOffset,eye+bob+shakeJitter,pos.z+cz*forwardOffset+rz*sideOffset);
  camera.lookAt(camera.position.x+sx*42,eye-.42,camera.position.z+cz*42);
  cockpit.visible=true;cockpitInterior.visible=true;cockpitExterior.visible=true;
  hood.material.color.copy(player.paint.color);hood.position.z=-2.55;hood.visible=!['bus','van','truck'].includes(player.type);
  wheel.rotation.z=THREE.MathUtils.lerp(wheel.rotation.z,player.input.s*.54,1-Math.exp(-dt*10));
 }
 camera.updateMatrixWorld(true);
 shadowTick+=dt;if(shadowTick>=1/30){shadowTick=0;const x=Math.round(player.x/16)*16,z=Math.round(player.z/16)*16;sun.position.set(x-35,65,z+28);sun.target.position.set(x,0,z);sun.shadow.needsUpdate=true;}
 playerRing.visible=false;targetRing.visible=running&&!!swapTarget;tether.visible=running&&swapProgress>0&&!!swapTarget;$('targetLabel').classList.toggle('hidden',!running||!swapTarget);
 if(swapTarget&&running){const tp=swapTarget.g.position;targetRing.position.set(tp.x,.13,tp.z);targetRing.scale.setScalar(1+Math.sin(simTime*7)*.06);targetRing.material.opacity=.55+swapProgress*.4;
  const screen=V(tp.x,2.8,tp.z).project(camera),inFront=(tp.x-camera.position.x)*sx+(tp.z-camera.position.z)*cz>0;
  const left=(tp.x-pos.x)*cz-(tp.z-pos.z)*sx>0,edge=!inFront||Math.abs(screen.x)>1;
  const screenX=edge?(left?.08:.92):clamp(screen.x*.5+.5,.08,.92),screenY=edge?.5:clamp(-screen.y*.5+.5,.16,.73);
  $('targetLabel').style.left=screenX*innerWidth+'px';$('targetLabel').style.top=screenY*innerHeight+'px';$('targetLabel').textContent=(edge?(left?'← ':'→ '):'')+'E / '+swapTarget.s.name;
  if(tether.visible){for(let i=0;i<13;i++){const t=i/12;tetherArray[i*3]=THREE.MathUtils.lerp(pos.x,tp.x,t)+(i>0&&i<12?rand(-.4,.4):0);tetherArray[i*3+1]=1.5+Math.sin(t*Math.PI)*3+rand(0,.25);tetherArray[i*3+2]=THREE.MathUtils.lerp(pos.z,tp.z,t)+(i>0&&i<12?rand(-.4,.4):0);}tetherGeo.attributes.position.needsUpdate=true;}
 }
 flash=Math.max(0,flash-dt*2.8);shake=Math.max(0,shake-dt*1.6);callout=Math.max(0,callout-dt*1.3);$('flash').style.opacity=flash*.32;$('callout').style.opacity=callout;$('callout').style.transform=`translate(-50%,-50%) scale(${1+(1-callout)*.25})`;
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('error').classList.remove('hidden');$('errorText').textContent='The graphics context was interrupted. Reconnect to rebuild the city.';});

// Save simulation values only; GPU objects are rebuilt from the local game source.
const vehicleFields=['id','type','x','z','a','vx','vz','hp','role','route','wp','desired','echo','echoInput','input','steer','history','credit','depth','hitCD','near','disabled','deadTime','swapLock','nav','navPath','lastNode','stuck'];
function checkpoint(){
 try {
  archiveData.prefs={selected,muted,cameraMode,difficulty};
  if(['playing','paused','ending'].includes(state)&&player){
   archiveData.checkpoint={version:1,elapsed,score,heat,wanted,peakWanted,arrest,spawnTimer,blockTimer,swapCooldown,swapProgress,turboCharge,turboTime,combo,comboTime,simTime,stats,worldRandom,playerId:player.id,swapTargetId:swapTarget?.id??null,vehicles:vehicles.map(v=>({...Object.fromEntries(vehicleFields.map(key=>[key,v[key]])),color:'#'+(v.paint.userData.original||v.paint.color).getHexString()})),blocks:blocks.map(b=>({x:b.x,z:b.z,axis:b.axis,life:b.life,solids:b.solids,carIds:b.cars.map(v=>v.id)}))};
  }
  saveArchive();storageWarning='';
 }catch(error){storageWarning='SAVE FAILED · '+error.message;notify('SAVE FAILED',error.message,10);}
}
function restoreCheckpoint(){
 const prefs=archiveData.prefs||{};if(['coupe','hatch','muscle','roadster','pickup'].includes(prefs.selected))selected=prefs.selected;muted=!!prefs.muted;audio.setMuted(muted);$('mute').textContent=muted?'SOUND OFF · M':'SOUND ON · M';setCameraMode(prefs.cameraMode);
 document.querySelectorAll('[data-car]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.car===selected)));
 const saved=archiveData.checkpoint;if(!saved)return;
 if(saved.version!==1||!Array.isArray(saved.vehicles)||saved.vehicles.length>100||!saved.vehicles.some(v=>v.id===saved.playerId)||saved.vehicles.some(v=>!TYPES[v.type]||!['x','z','a','vx','vz','hp'].every(key=>Number.isFinite(v[key]))))throw new Error('Saved chase is invalid. Original save has been retained.');
 for(const v of [...vehicles])removeVehicle(v);for(const b of blocks)scene.remove(b.g);blocks=[];player=null;
 for(const data of saved.vehicles){const v=createVehicle(data.type,data.x,data.z,data.a,data.role,data.route);for(const key of vehicleFields)if(key in data)v[key]=data[key];v.px=v.x;v.pz=v.z;v.pa=v.a;v.paint.color.set(data.color);v.paint.userData.original=v.paint.color.clone();if(v.id===saved.playerId)player=v;}
 nextId=Math.max(...vehicles.map(v=>v.id))+1;
 for(const data of saved.blocks||[]){const g=new THREE.Group();scene.add(g);g.position.set(data.x,0,data.z);if(data.axis==='x')g.rotation.y=Math.PI/2;for(let k=-2;k<=1;k++){box(g,k*3,.58,0,2.4,1,.65,k%2?'#f5d482':'#dd847c');box(g,k*3,.99,0,2.42,.16,.68,'#f4edca');}blocks.push({...data,g,cars:data.carIds.map(id=>vehicles.find(v=>v.id===id)).filter(Boolean)});}
 ({elapsed,score,heat,wanted,peakWanted,arrest,spawnTimer,blockTimer,swapCooldown,swapProgress,turboCharge,turboTime,combo,comboTime,simTime,stats,worldRandom}=saved);swapTarget=vehicles.find(v=>v.id===saved.swapTargetId)||null;state='paused';clearKeys();cameraYaw=player.a;renderAlpha=1;runPersisted=false;$('title').classList.add('hidden');$('hud').classList.remove('hidden');$('pause').classList.remove('hidden');visuals(0);hud(0);notify('CHASE RESTORED','Resume when you are ready.',3);
}
setInterval(()=>{if(state==='playing'||state==='ending')checkpoint();},500);
window.addEventListener('beforeunload',checkpoint);

resetRun(true);window.gameReady=true;$('loading').classList.add('hidden');$('start').disabled=false;$('start').innerHTML='START CHASE <span>↗</span>';
restoreCheckpoint();
const FPS_LIMIT=120,FRAME_INTERVAL=1/FPS_LIMIT;
let lastRAF=performance.now(),pendingWall=0,frameBudget=FRAME_INTERVAL;
function frame(now){requestAnimationFrame(frame);const rawDt=Math.max(0,(now-lastRAF)/1000);lastRAF=now;pendingWall+=rawDt;frameBudget+=rawDt;if(frameBudget+1e-6<FRAME_INTERVAL)return;frameBudget%=FRAME_INTERVAL;const wallDt=pendingWall,pendingCap=Math.min(wallDt,.05);pendingWall=0;const realDt=pendingCap;
 if(state==='playing')swapUpdate(realDt);
 let scale=state==='playing'&&keys.KeyE&&!swapHeldLatch&&validTarget(swapTarget,true)&&swapCooldown<=0?.28:1;
 if(state==='ending'){gameOverTimer+=realDt;scale=.16;if(gameOverTimer>=1.4)showResults();}
 if(state==='playing'||state==='title'||state==='ending'){const total=realDt*scale;accumulator=Math.min(accumulator+total,FIXED_STEP*6);while(accumulator+1e-9>=FIXED_STEP){accumulator=Math.max(0,accumulator-FIXED_STEP);simulation(FIXED_STEP);}renderAlpha=accumulator/FIXED_STEP;updateParticles(total);}
 visuals(realDt);if(state==='playing'||state==='ending'){hudTick+=realDt;if(hudTick>=1/30){hud(hudTick);hudTick=0;}}
 if(state==='playing'){fpsTime+=wallDt;fpsFrames++;if(fpsTime>=1){fpsLabel.textContent=Math.round(fpsFrames/fpsTime)+' FPS';fpsTime=fpsFrames=0;}}
 const threat=vehicles.reduce((n,v)=>v.role==='cop'&&!v.disabled?Math.max(n,clamp(1-dist(v,player)/80,0,1)):n,0);audio.update(Math.hypot(player.vx,player.vz)/player.s.max,threat,realDt,state==='playing');renderer.render(scene,camera);
}
requestAnimationFrame(frame);
