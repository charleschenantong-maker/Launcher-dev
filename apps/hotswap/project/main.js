
import * as THREE from "./vendor/three.module.js";
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
const rand=(a,b)=>a+Math.random()*(b-a), choice=a=>a[Math.floor(Math.random()*a.length)];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)), dist=(a,b)=>Math.sqrt((a.x-b.x)*(a.x-b.x)+(a.z-b.z)*(a.z-b.z));
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const scene=new THREE.Scene();scene.background=new THREE.Color('#8fc7ed');scene.fog=new THREE.Fog('#b7c3c7',260,520);
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,powerPreference:'high-performance'}); // Weather never uses a full-screen colour filter.
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight); // Internal rendering is locked to 1920×1080 and CSS-upscaled to the display.
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,285);scene.add(camera);
const hemi=new THREE.HemisphereLight('#e7fff1','#66817c',2.5);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0cf',3.3);sun.position.set(-35,65,28);sun.castShadow=true;
sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:180});sun.shadow.bias=-.0005;sun.shadow.normalBias=.07;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;scene.add(sun,sun.target);
const moon=new THREE.DirectionalLight('#ffffff',0);moon.position.set(35,45,-28);moon.castShadow=false;scene.add(moon,moon.target);
// Celestial discs are intentionally untinted by fog/tone mapping so they remain visibly present in the sky.
const sunOrb=new THREE.Mesh(new THREE.SphereGeometry(13.5,28,20),new THREE.MeshBasicMaterial({color:'#fff2a8',fog:false,depthTest:false,depthWrite:false,toneMapped:false}));sunOrb.frustumCulled=false;sunOrb.renderOrder=60;scene.add(sunOrb);
const moonOrb=new THREE.Mesh(new THREE.SphereGeometry(9.5,28,20),new THREE.MeshBasicMaterial({color:'#edf3ff',fog:false,depthTest:false,depthWrite:false,toneMapped:false}));moonOrb.frustumCulled=false;moonOrb.renderOrder=59;scene.add(moonOrb);
const DAY_SKY=new THREE.Color('#8fc7ed'),TWILIGHT_SKY=new THREE.Color('#e68d67'),NIGHT_SKY=new THREE.Color('#06111f');
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
const motoCockpit=new THREE.Group();camera.add(motoCockpit);
const motoCockpitTank=box(motoCockpit,0,-.82,-1.42,.72,.36,1.32,'#ef3038');motoCockpitTank.material=mat('#ef3038').clone();
box(motoCockpit,0,-.55,-1.03,.72,.08,.16,'#182b31');
box(motoCockpit,0,-.43,-.98,.08,.24,.08,'#263f46');
box(motoCockpit,0,-.31,-.97,1.22,.055,.055,'#556f72');
for(const side of [-1,1]){box(motoCockpit,side*.52,-.24,-.96,.06,.32,.06,'#263f46',0,0,side*.28);box(motoCockpit,side*.57,-.08,-.97,.22,.1,.08,'#446470');}
box(motoCockpit,0,-.30,-.92,.3,.16,.07,'#101e25');box(motoCockpit,0,-.30,-.88,.16,.05,.03,'#e4ff74');
motoCockpit.visible=false;
for(const side of [-1,1]){
 const pillar=box(cockpitInterior,side*1.2,-.03,-1.22,.09,1.52,.11,'#304b52');pillar.rotation.z=side*.13;
 box(cockpitExterior,side*.98,-.77,-1.7,.2,.1,1.8,'#314c53');
}
const wheel=new THREE.Group();wheel.position.set(-.48,-.6,-.79);cockpitInterior.add(wheel);
const rim=new THREE.Mesh(new THREE.TorusGeometry(.27,.035,5,14),mat('#152d35'));wheel.add(rim);
box(wheel,0,0,0,.45,.04,.04,'#526d70');box(wheel,0,-.11,0,.04,.24,.04,'#526d70');box(wheel,0,0,.01,.12,.08,.05,'#e4ff74');
cockpit.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
function block(x,y,z,w,h,d,c,rot=0){const key=batchZone+'|'+c;if(!batches.has(key))batches.set(key,[]);batches.get(key).push([x,y,z,w,h,d,rot]);}
const GRID_SECTORS=20,SECTOR=58,ROAD_HALF=9.5,MID=Math.floor(GRID_SECTORS/2);
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
 // Recessed framed windows: glass sits inside a dark reveal instead of floating on the wall.
 for(let level=fromY;level<toY-.75;level+=spacing){
  const cols=Math.max(2,Math.min(6,Math.floor(w/3.05))),bay=(w-2.0)/cols;
  for(let t=0;t<cols;t++){
   const u=-w/2+1+bay*(t+.5),lit=seeded()>.76,glassColor=lit?'#e8d49c':'#426a73';
   for(const face of [-1,1]){
    const fz=bz+face*(d/2+.055);block(bx+u,level,fz,Math.min(1.72,bay*.62),1.46,.11,'#304c53');
    block(bx+u,level,fz+face*.061,Math.min(1.44,bay*.52),1.18,.035,glassColor);
    block(bx+u,level-.76,fz+face*.045,Math.min(1.76,bay*.64),.08,.13,'#737c78');
   }
  }
  const sideCols=Math.max(2,Math.min(5,Math.floor(d/3.2))),sideBay=(d-2.0)/sideCols;
  for(let t=0;t<sideCols;t++){
   const u=-d/2+1+sideBay*(t+.5),lit=seeded()>.78,glassColor=lit?'#e8d49c':'#426a73';
   for(const face of [-1,1]){
    const fx=bx+face*(w/2+.055);block(fx,level,bz+u,.11,1.46,Math.min(1.72,sideBay*.62),'#304c53');
    block(fx+face*.061,level,bz+u,.035,1.18,Math.min(1.44,sideBay*.52),glassColor);
    block(fx+face*.045,level-.76,bz+u,.13,.08,Math.min(1.76,sideBay*.64),'#737c78');
   }
  }
 }
}
function rooftopKit(bx,bz,w,d,y,style){
 const roof=roofTones[Math.floor(seeded()*roofTones.length)],parapet='#697571';
 // Proper roof slab and four-sided parapet, all sitting on the roof perimeter.
 block(bx,y+.12,bz,w+.18,.24,d+.18,'#d8d6ca');
 block(bx,y+.62,bz+d/2-.13,w,.76,.26,parapet);block(bx,y+.62,bz-d/2+.13,w,.76,.26,parapet);
 block(bx+w/2-.13,y+.62,bz,.26,.76,d-.52,parapet);block(bx-w/2+.13,y+.62,bz,.26,.76,d-.52,parapet);
 const units=style==='tower'?3:style==='slab'?2:1;
 for(let n=0;n<units;n++){const uw=Math.max(1.5,w*(.13+seeded()*.08)),ud=Math.max(1.4,d*(.12+seeded()*.07)),ux=bx+(seeded()-.5)*w*.42,uz=bz+(seeded()-.5)*d*.38;block(ux,y+.72,uz,uw,.78,ud,roof);block(ux,y+1.14,uz,uw*.72,.08,ud*.72,'#4e6568');}
 if(style==='tower'||seeded()>.62){const ax=bx+(seeded()-.5)*w*.25,az=bz+(seeded()-.5)*d*.22;block(ax,y+2.02,az,.10,2.7,.10,'#465e61');block(ax+.42,y+3.29,az,.82,.08,.08,'#465e61');}
}
function shadeHex(hex,factor=1){
 const c=new THREE.Color(hex);c.r=clamp(c.r*factor,0,1);c.g=clamp(c.g*factor,0,1);c.b=clamp(c.b*factor,0,1);return '#'+c.getHexString();
}
function addArchitecturalDetail(bx,bz,w,d,h,style,c){
 // Everything here is physically attached to the main mass: no free-floating facade bands.
 const baseTop=.43,front=bz+d/2+.075,back=bz-d/2-.075,entryW=clamp(w*.22,2.4,5.2),entryH=Math.min(2.8,h*.38);
 // Foundation/plinth hides the old hovering seam at ground level.
 block(bx,baseTop+.24,bz,w+.16,.48,d+.16,'#6d746f');
 // Corner piers connect ground to roof and visually carry the facade.
 const facadeTrim=shadeHex(c||'#87918c',style==='tower'?.78:.83),facadeEdge=shadeHex(c||'#87918c',style==='tower'?1.06:.94);
 for(const side of [-1,1]){
  const edge=style==='tower'?.16:.26;
  block(bx+side*(w/2-edge),h/2+.42,bz,edge*1.35,Math.max(.8,h-.05),d-.20,facadeTrim);
  block(bx,h/2+.42,bz+side*(d/2-edge),w-.20,Math.max(.8,h-.05),edge*1.35,facadeTrim);
 }
 if(style==='tower'&&h>22){
  // Attached vertical mullions keep the upper facade coloured instead of becoming a grey cage.
  for(const side of [-1,1]){block(bx+side*w*.29,h/2+.42,bz+d/2+.08,.11,h-.6,.08,facadeEdge);block(bx+side*w*.29,h/2+.42,bz-d/2-.08,.11,h-.6,.08,facadeEdge);}
 }
 // Ground-floor lobby/storefront: recessed glass, framed door and structural columns.
 block(bx,entryH/2+.52,front,entryW,entryH,.16,'#243e46');
 block(bx,entryH/2+.52,front+.095,entryW*.78,entryH*.78,.035,'#5c858c');
 block(bx,entryH+.68,front+.10,entryW+1.05,.22,.62,'#8d9289');
 for(const side of [-1,1])block(bx+side*(entryW*.54),entryH/2+.50,front+.24,.18,entryH+.05,.18,'#555f5c');
 // Supported canopy (columns reach the pavement, unlike the old floating strips).
 if(style!=='warehouse'){
  const canopyW=Math.min(w*.70,entryW+5.2);block(bx,3.18,front+.72,canopyW,.18,1.30,'#777f7a');
  for(const side of [-1,1])block(bx+side*(canopyW*.43),1.73,front+.83,.18,2.72,.18,'#525d5a');
 }
 // Rear service door / loading access so the back is not a blank cube.
 block(bx,1.45,back,Math.min(3.2,w*.26),2.25,.14,'#34484d');block(bx,2.68,back-.07,Math.min(3.5,w*.29),.16,.32,'#6a7470');
 // Downpipes are vertical and terminate at ground.
 if(h>8)for(const side of [-1,1])block(bx+side*(w/2+.06),Math.min(h*.42,5.2),bz-d*.22,.10,Math.min(9.0,h*.78),.10,'#485b5d');
 // Warehouse-specific grounded loading doors.
 if(style==='warehouse'){
  for(const side of [-1,1]){const px=bx+side*w*.26;block(px,1.68,front+.09,w*.23,2.55,.18,'#3b4f53');for(let y=.78;y<2.78;y+=.42)block(px,y,front+.20,w*.21,.055,.04,'#76827d');}
 }
}
function addCityBuilding(bx,bz,w,d,h,c,style){
 solids.push({x:bx,z:bz,w:w/2,d:d/2});
 const ground=.43;
 if(style==='tower'){
  const podiumH=rand(5.2,7.2),tw=w*rand(.58,.72),td=d*rand(.58,.72),tx=bx+rand(-w*.04,w*.04),tz=bz+rand(-d*.04,d*.04),towerH=Math.max(18,h-podiumH);
  const c0=shadeHex(c,.92),c1=shadeHex(c,1.04),c2=shadeHex(c,.97),c3=shadeHex(c,1.08);
  block(bx,ground+podiumH/2,bz,w,podiumH,d,c0);cityWindowRows(bx,bz,w,d,3.25,podiumH,2.85);
  block(bx,podiumH+ground+.16,bz,w+.20,.32,d+.20,shadeHex(c,.78));
  // Three physically stacked facade masses: upper floors retain the building colour instead of a grey shell.
  const h1=towerH*.46,h2=towerH*.32,h3=towerH-h1-h2;
  block(tx,podiumH+ground+h1/2,tz,tw,h1,td,c1);cityWindowRows(tx,tz,tw,td,podiumH+2.1,podiumH+h1-.2,3.0);
  const tw2=tw*.88,td2=td*.90,y2=podiumH+h1;block(tx,y2+ground+h2/2,tz,tw2,h2,td2,c2);cityWindowRows(tx,tz,tw2,td2,y2+1.6,y2+h2-.2,2.95);
  const tw3=tw*.72,td3=td*.74,y3=y2+h2;block(tx,y3+ground+h3/2,tz,tw3,h3,td3,c3);cityWindowRows(tx,tz,tw3,td3,y3+1.4,y3+h3-.25,2.85);
  for(const side of [-1,1])block(tx+side*(tw3/2-.15),podiumH+towerH-1.8,tz,.20,3.6,td3*.78,shadeHex(c,.72));
  rooftopKit(tx,tz,tw3,td3,podiumH+towerH+ground,'tower');
 }else if(style==='stepped'){
  const lower=Math.max(6,h*.52),upperH=h-lower,uw=w*rand(.64,.82),ud=d*rand(.62,.82),ux=bx+rand(-.8,.8),uz=bz+rand(-.8,.8);
  block(bx,ground+lower/2,bz,w,lower,d,c);cityWindowRows(bx,bz,w,d,3.1,lower-.3,3.0);
  block(bx,ground+lower+.16,bz,w+.16,.32,d+.16,'#9a9d94');
  block(ux,ground+lower+upperH/2,uz,uw,upperH,ud,c);cityWindowRows(ux,uz,uw,ud,lower+1.8,h-.3,3.0);rooftopKit(ux,uz,uw,ud,h+ground,'stepped');
 }else if(style==='slab'){
  block(bx,ground+h/2,bz,w,h,d,c);cityWindowRows(bx,bz,w,d,3.05,h-.35,3.05);
  // Full-height side cores replace the old unsupported horizontal stripes.
  for(const side of [-1,1])block(bx+side*(w/2-.35),ground+h/2,bz,.46,h-.25,d*.76,'#74827e');
  rooftopKit(bx,bz,w,d,h+ground,'slab');
 }else if(style==='warehouse'){
  block(bx,ground+h/2,bz,w,h,d,c);
  // Low industrial clerestory windows and roof ribs that actually sit on the roof.
  const cols=Math.max(4,Math.floor(w/4.2));for(let t=0;t<cols;t++){const u=(t/(cols-1)-.5)*(w-3.0);for(const face of [-1,1])block(bx+u,Math.min(h-1.1,3.5),bz+face*(d/2+.06),1.65,.72,.10,'#456b72');}
  for(let x=-w*.38;x<=w*.38;x+=Math.max(3.8,w/6))block(bx+x,h+ground+.30,bz,.20,.60,d*.90,'#778681');rooftopKit(bx,bz,w,d,h+ground,'warehouse');
 }else if(style==='civic'){
  const wingH=Math.max(5.2,h*.46),coreW=w*.48,coreD=d*.50;
  block(bx,ground+wingH/2,bz,w,wingH,d,c);cityWindowRows(bx,bz,w,d,3.1,wingH-.3,3.1);
  block(bx,ground+h/2,bz,coreW,h,coreD,c);cityWindowRows(bx,bz,coreW,coreD,wingH+1.6,h-.3,3.0);
  for(const side of [-1,1]){block(bx+side*w*.31,ground+wingH+.72,bz,w*.19,1.25,d*.70,'#d5d2c6');block(bx+side*w*.31,ground+wingH/2,bz,w*.15,wingH-.15,d*.08,'#8b918a');}
  rooftopKit(bx,bz,coreW,coreD,h+ground,'civic');
 }else{
  block(bx,ground+h/2,bz,w,h,d,c);cityWindowRows(bx,bz,w,d,3.05,h-.35,style==='low'?2.8:3.0);rooftopKit(bx,bz,w,d,h+ground,style);
 }
 addArchitecturalDetail(bx,bz,w,d,h,style,c);
}
function makePark(x,z){block(x,.46,z,35,.12,35,'#91af8f');block(x,.53,z,4,.06,35,'#d8ceb0');block(x,.53,z,35,.06,4,'#d8ceb0');block(x,.63,z,8,.2,8,'#d1d8bc');block(x,.76,z,6,.25,6,'#79aead');for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){tree(x+a*11,z+b*11);tree(x+a*7,z+b*13);}}


// ---- Grounded city assets / landmarks ------------------------------------------------------
// All facade details below are attached to walls, columns, roofs or pavement. No unsupported strips.
function addConvenienceStore(x,z){
 const w=rand(18,23),d=rand(14,18),h=rand(4.6,5.6),c=choice(['#e1dfd2','#d1d4c9','#c8cbc2']);
 addCityBuilding(x,z,w,d,h,c,'low');const front=z+d/2+.10;
 block(x,1.86,front,w*.78,2.28,.12,'#31555e');block(x,1.86,front+.075,w*.68,1.88,.035,'#79a9ad');
 const canopyW=w*.84;block(x,3.25,front+.68,canopyW,.18,1.18,'#d8d1b6');
 for(const side of [-1,1])block(x+side*canopyW*.43,1.72,front+.76,.18,2.86,.18,'#5a6460');
 block(x,3.72,front+.18,w*.70,.54,.14,'#e4ff74');
}
function addLuxuryResidence(x,z){
 const w=rand(24,30),d=rand(22,28),h=rand(18,32),c=choice(['#ddd7cc','#c8d0ca','#d2c4bb','#b8c8c2']);
 addCityBuilding(x,z,w,d,h,c,'stepped');
 // Grounded balcony stacks: vertical edge posts run continuously to the pavement.
 for(const side of [-1,1]){
  const fx=x+side*(w/2+.26);block(fx,h/2+.35,z,.12,h-.30,d*.58,'#6e7975');
  for(let y=5.0;y<h-2.2;y+=5.4){block(fx,y,z,.54,.16,d*.55,'#d8d7cb');block(fx+side*.20,y+.52,z,.08,1.00,d*.53,'#7a8580');}
 }
 tree(x-w*.58,z-d*.42);tree(x+w*.58,z+d*.42);
}
function addOldWalkup(x,z){
 const w=rand(13,17),d=rand(12,16),h=rand(11,20),c=choice(['#a97863','#b28770','#8f756a','#9e8065']);
 addCityBuilding(x,z,w,d,h,c,'mid');
 // Fire escape has continuous legs + attached platforms, so nothing floats.
 const sideX=x+w/2+.30;for(const zz of [-1,1])block(sideX+.16,h*.42,z+zz*d*.27,.10,Math.min(h*.80,13),.10,'#34494e');
 for(let y=4.0;y<h-1.4;y+=3.2){block(sideX,y,z,.52,.10,d*.58,'#34494e');for(let zz=-2;zz<=2;zz++)block(sideX+.16,y+.38,z+zz*d*.12,.06,.76,.06,'#52666a');}
 block(sideX+.10,1.55,z,.12,2.8,d*.54,'#40545a');
}
const fuelStations=[],landmarkMarkers=[];
const FUEL_STATION_CELLS=new Set(['1,3','2,10','3,17','5,6','6,14','8,2','9,18','11,5','12,12','14,8','16,16','18,4','18,13']);
function makeFuelStation(x,z){
 // Concrete forecourt / convenience store / canopy / pumps / tall illuminated pylon.
 block(x,.46,z,36,.16,36,'#b8b7aa');block(x+8,2.75,z+9,17,4.8,10,'#d7d5c8');
 solids.push({x:x+8,z:z+9,w:8.5,d:5});
 const shopFront=z+4.02;block(x+8,2.10,shopFront,13.8,2.55,.12,'#315660');block(x+8,2.10,shopFront+.08,12.4,2.12,.035,'#76a7ad');
 block(x-4,4.45,z-4,25,.32,11,'#e8e2c8');
 for(const px of [-13,5])for(const pz of [-8,0])block(x+px,2.25,z+pz,.28,4.5,.28,'#59635f');
 const pumps=[];for(const px of [-10,-5,0,5]){const pz=z-4;block(x+px,1.15,pz,.86,1.92,.70,'#3c5961');block(x+px,1.86,pz,.68,.36,.74,'#e4ff74');block(x+px,1.22,pz-.38,.34,.62,.05,'#162e37');solids.push({x:x+px,z:pz,w:.46,d:.38});pumps.push({x:x+px,z:pz});}
 // Tall landmark sign; geometry reaches the pavement and is visible above traffic.
 block(x+15,4.55,z-13,.48,8.9,.48,'#41595c');block(x+15,8.25,z-13,3.7,2.2,.52,'#e4ff74');block(x+15,8.18,z-13.30,2.7,.34,.055,'#173640');
 fuelStations.push({x,z,pumps});
}
function landmarkBase(x,z,color='#aaa99e'){block(x,.45,z,36,.16,36,color);}
const landmarkMaterials=new Map();
function landmarkMat(color,rough=.34,metal=.18,emissive=false){const key=[color,rough,metal,emissive].join('|');if(!landmarkMaterials.has(key))landmarkMaterials.set(key,new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive:emissive?color:0,emissiveIntensity:emissive?.45:0,side:THREE.DoubleSide}));return landmarkMaterials.get(key);}
function lmMesh(geo,color,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,rough=.34,metal=.18){const m=new THREE.Mesh(geo,landmarkMat(color,rough,metal));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
function lmBox(x,y,z,w,h,d,color,rx=0,ry=0,rz=0,rough=.34,metal=.18){return lmMesh(boxGeo,color,x,y,z,w,h,d,rx,ry,rz,rough,metal);}
function lmCylinder(x,y,z,r,h,color,segments=12,topScale=1,ry=0,rough=.30,metal=.25){const g=new THREE.CylinderGeometry(r*topScale,r,h,segments,1,false);return lmMesh(g,color,x,y,z,1,1,1,0,ry,0,rough,metal);}
function lmBeam(x1,y1,z1,x2,y2,z2,t,color){const a=V(x1,y1,z1),b=V(x2,y2,z2),mid=a.clone().add(b).multiplyScalar(.5),dir=b.clone().sub(a),len=dir.length();const m=new THREE.Mesh(boxGeo,landmarkMat(color,.42,.52));m.position.copy(mid);m.scale.set(t,len,t);m.quaternion.setFromUnitVectors(V(0,1,0),dir.normalize());m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
function landmarkCollision(x,z,w=15,d=15){solids.push({x,z,w:w/2,d:d/2});}
function makeEiffelTower(x,z){
 landmarkBase(x,z,'#a6aa9d');landmarkCollision(x,z,25,25);const iron='#604f45',ironHi='#78645a';
 const levels=[{y:1,r:11},{y:18,r:6.4},{y:33,r:3.6},{y:54,r:1.35}];
 for(let k=0;k<levels.length-1;k++){const a=levels[k],b=levels[k+1];for(const sx of [-1,1])for(const sz of [-1,1])lmBeam(x+sx*a.r,a.y,z+sz*a.r,x+sx*b.r,b.y,z+sz*b.r,k<1?.48:.34,iron);}
 // Perimeter lattice braces referenced from the tower's criss-cross iron silhouette.
 for(const y of [6,11.5,23,28,39,45,50]){let r=y<18?11-(y-1)/17*4.6:y<33?6.4-(y-18)/15*2.8:3.6-(y-33)/21*2.25;for(const side of [-1,1]){lmBeam(x-r,y-1.8,z+side*r,x+r,y+1.8,z+side*r,.16,ironHi);lmBeam(x+side*r,y-1.8,z-r,x+side*r,y+1.8,z+r,.16,ironHi);}}
 for(const [y,r] of [[18,7.1],[33,4.25],[54,1.8]]){lmBox(x,y,z,r*2,.55,r*2,ironHi);lmBox(x,y+.42,z,r*1.86,.22,r*1.86,'#a4937c');}
 lmCylinder(x,58.4,z,.62,8.2,ironHi,10,.55);lmCylinder(x,65.0,z,.15,5.0,'#4e4842',8,.45);
 landmarkMarkers.push({x,z,type:'E',name:'EIFFEL TOWER'});
}
function makeBurjKhalifa(x,z){
 landmarkBase(x,z,'#adb2ad');landmarkCollision(x,z,24,24);const glass='#6f9eae',glass2='#85b0bb',steel='#c7cdca';
 let y=.55;const tiers=[[12,11,12],[10.8,9.8,10],[9.3,8.6,9],[8.0,7.5,8],[6.8,6.4,7],[5.5,5.2,6],[4.2,4.0,5.5]];
 for(let i=0;i<tiers.length;i++){const [w,d,h]=tiers[i],cy=y+h/2,color=i%2?glass2:glass;lmCylinder(x,cy,z,Math.max(w,d)*.42,h,color,8,.90,Math.PI/8,.22,.48);for(let a=0;a<3;a++){const ang=a*TAU/3,off=Math.max(w,d)*.23;lmBox(x+Math.sin(ang)*off,cy,z+Math.cos(ang)*off,w*.46,h,d*.72,color,0,ang,0,.20,.48);}lmBox(x,y+h-.12,z,w*.82,.20,d*.82,steel);y+=h*.82;}
 lmCylinder(x,y+5.3,z,2.0,10.5,glass2,8,.42,Math.PI/8,.18,.52);lmCylinder(x,y+13,z,.36,10,'#d8dcd8',10,.32);
 landmarkMarkers.push({x,z,type:'K',name:'BURJ KHALIFA'});
}
function makeTaipei101(x,z){
 landmarkBase(x,z,'#aeb2a7');landmarkCollision(x,z,20,20);const jade='#5b8f89',jade2='#6ca19a',trim='#c2b889';
 lmBox(x,3.1,z,20,5.3,20,'#6f8f88');let y=5.7;
 for(let i=0;i<8;i++){const h=6.0,w=15.8-i*.55;const g=new THREE.CylinderGeometry(w*.43,w*.50,h,4,1,false);lmMesh(g,i%2?jade2:jade,x,y+h/2,z,1,1,1,0,Math.PI/4,0,.26,.34);lmBox(x,y+h-.38,z,w*1.04,.48,w*1.04,trim);for(const side of [-1,1]){lmBox(x+side*w*.42,y+h*.52,z,.16,h*.72,w*.75,shadeHex(jade,.75));lmBox(x,y+h*.52,z+side*w*.42,w*.75,h*.72,.16,shadeHex(jade,.75));}y+=h*.91;}
 lmBox(x,y+2.1,z,7.2,4.2,7.2,'#526f6d');lmCylinder(x,y+7.8,z,.62,9.5,'#394e50',10,.55);landmarkMarkers.push({x,z,type:'1',name:'TAIPEI 101'});
}
function makePetronas(x,z){
 landmarkBase(x,z,'#aeb1a8');landmarkCollision(x,z,27,20);const steel='#aebfc2',glass='#4f7882',ring='#d0d5d2';
 for(const cx of [x-7.4,x+7.4]){let y=.6;for(let i=0;i<7;i++){const h=6.4-i*.22,r=4.6-i*.20;lmCylinder(cx,y+h/2,z,r,h,i%2?glass:steel,12,.92,Math.PI/12,.22,.56);lmCylinder(cx,y+h-.22,z,r*1.04,.34,ring,12,1,Math.PI/12,.22,.65);y+=h*.93;}lmCylinder(cx,y+3.5,z,2.45,7,'#96aeb1',10,.62);lmCylinder(cx,y+10.2,z,.38,8.8,ring,10,.32);}
 // Skybridge and diagonal braces around the characteristic mid-height connection.
 lmBox(x,30.0,z,10.8,2.2,3.2,'#aebfc2');lmBox(x,30.0,z,9.8,1.25,3.34,'#52717a');for(const side of [-1,1]){lmBeam(x+side*5.0,27.0,z-1.4,x+side*7.4,23.4,z-1.4,.18,ring);lmBeam(x+side*5.0,27.0,z+1.4,x+side*7.4,23.4,z+1.4,.18,ring);}
 landmarkMarkers.push({x,z,type:'P',name:'PETRONAS TOWERS'});
}
function makeSydneyOperaHouse(x,z){
 landmarkBase(x,z,'#9fa9a2');landmarkCollision(x,z,28,22);lmBox(x,1.05,z,30,1.2,21,'#c0b39c');lmBox(x,1.75,z-7.8,25,1.2,4.2,'#564e45');
 const shellGeo=new THREE.SphereGeometry(1,22,12,0,Math.PI,0,Math.PI/2),shell='#e6e2d6';
 const shells=[[-9,4.0,1.7,5.8,10.5,3.0,-.58,.10],[-4,4.6,1.0,6.8,12.0,3.2,-.48,.06],[2,5.0,.4,7.8,13.6,3.4,-.40,-.02],[8,4.2,1.2,6.2,10.8,3.0,-.52,-.09],[-1,3.3,-5.5,5.0,8.4,2.6,-.70,.04]];
 for(const [dx,y,dz,sx,sy,sz,rz,ry] of shells){const m=lmMesh(shellGeo,shell,x+dx,y,z+dz,sx,sy,sz,0,ry,rz,.30,.04);m.rotation.x=-.15;}
 // Dark glass walls sit beneath the sails instead of floating panels.
 for(const dx of [-8,-2,4,9])lmBox(x+dx,2.45,z+2.0,4.5,2.7,.22,'#355861',0,0,0,.18,.16);
 landmarkMarkers.push({x,z,type:'O',name:'SYDNEY OPERA HOUSE'});
}
function makeEmpireState(x,z){
 landmarkBase(x,z,'#aaa99f');landmarkCollision(x,z,23,23);const stone='#b7ad98',stone2='#c8bea7',dark='#4e5d5f';let y=.55;
 const tiers=[[22,22,11],[18,18,27],[14,14,13],[10,10,8],[7,7,5]];for(let i=0;i<tiers.length;i++){const [w,d,h]=tiers[i];lmBox(x,y+h/2,z,w,h,d,i%2?stone2:stone);for(const side of [-1,1])for(let k=-2;k<=2;k++){lmBox(x+k*w*.13,y+h/2,z+side*(d/2+.07),.18,h*.90,.10,dark);lmBox(x+side*(w/2+.07),y+h/2,z+k*d*.13,.10,h*.90,.18,dark);}y+=h;}
 lmBox(x,y+2.3,z,4.2,4.6,4.2,'#8f8b7f');lmCylinder(x,y+7.2,z,1.25,5.5,'#767c7a',8,.65);lmCylinder(x,y+13.0,z,.25,7.2,'#4c5657',10,.35);landmarkMarkers.push({x,z,type:'N',name:'EMPIRE STATE'});
}
function makeBigBen(x,z){
 landmarkBase(x,z,'#aaa99f');landmarkCollision(x,z,15,15);const stone='#ad8d62',stone2='#c5a876',roof='#4f615c';
 lmBox(x,16.0,z,10.6,31,10.6,stone);for(const side of [-1,1])for(let k=-2;k<=2;k++){lmBox(x+k*1.6,16,z+side*5.36,.16,29,.10,stone2);lmBox(x+side*5.36,16,z+k*1.6,.10,29,.16,stone2);}
 lmBox(x,34.4,z,12.4,6.2,12.4,stone2);lmBox(x,38.0,z,13.0,.55,13.0,'#7a684d');
 const clockGeo=new THREE.CircleGeometry(2.8,32),clockMat='#e7e0c8';for(const side of [-1,1]){lmMesh(clockGeo,clockMat,x,34.7,z+side*6.25,1,1,1,0,side<0?Math.PI:0,0,.22,.02);lmBox(x,34.7,z+side*6.34,.16,4.0,.10,'#2f3736',0,0,.12);lmBox(x,34.7,z+side*6.36,.12,2.7,.10,'#2f3736',0,0,-1.0);}for(const side of [-1,1]){lmMesh(clockGeo,clockMat,x+side*6.25,34.7,z,1,1,1,0,side>0?Math.PI/2:-Math.PI/2,0,.22,.02);}
 const spire=new THREE.ConeGeometry(6.0,12,4);lmMesh(spire,roof,x,43.9,z,1,1,1,0,Math.PI/4,0,.34,.28);lmCylinder(x,51.2,z,.22,4.5,'#4e5552',8,.35);landmarkMarkers.push({x,z,type:'B',name:'ELIZABETH TOWER'});
}
function makeMarinaBaySands(x,z){
 landmarkBase(x,z,'#a8aaa3');landmarkCollision(x,z,31,22);const glass='#5e8290',frame='#aeb9b6',deck='#6f7773';
 for(const cx of [x-10,x,x+10]){lmBox(cx,20.5,z,7.2,39,12.2,glass,0,0,cx===x?0:(cx<x?.035:-.035),.20,.36);for(let y=4;y<39;y+=4.2)lmBox(cx,y,z+6.16,6.3,.13,.08,frame);lmBox(cx,20.5,z-6.16,6.3,37,.08,shadeHex(glass,.82));}
 lmBox(x,41.0,z,32.5,2.7,7.2,deck,0,0,-.018,.26,.38);lmCylinder(x-16.0,41.0,z,3.6,2.7,deck,18,1,Math.PI/2,.26,.38);lmCylinder(x+16.0,41.0,z,3.6,2.7,deck,18,1,Math.PI/2,.26,.38);
 // Rooftop garden / infinity-edge silhouette.
 lmBox(x+4,42.45,z+1.8,20,.28,2.1,'#79a990');for(const px of [-11,-5,1,7,13])lmBox(x+px,43.0,z-1.4,.42,1.1,.42,'#55755f');
 landmarkMarkers.push({x,z,type:'S',name:'MARINA BAY SANDS'});
}
function makeWalmart(x,z){
 landmarkBase(x,z,'#b8b9b1');const bx=x,bz=z+8,w=34,d=18,h=7.2;
 solids.push({x:bx,z:bz,w:w/2,d:d/2});block(bx,h/2+.44,bz,w,h,d,'#d5d7d2');
 block(bx,4.1,bz-d/2-.08,w,.82,.18,'#1f69a8');block(bx,2.2,bz-d/2-.16,12,3.4,.18,'#2c5964');block(bx,2.2,bz-d/2-.25,10.4,2.8,.035,'#7db3bd');
 // Yellow spark mark made from attached bars, no floating facade ribbons.
 for(const a of [-1,0,1])block(bx+11+a*.42,4.15,bz-d/2-.22,.18,.74,.12,'#f4d94f',a*.45);
 // Parking lot in front with bays and two landscaped islands.
 for(let row=0;row<4;row++)for(let k=-7;k<=7;k++)block(x+k*2.05,.56,z-11+row*3.1,1.55,.025,.08,'#eee6c9');
 for(const sx of [-11,11]){block(x+sx,.60,z-5,2.3,.18,8,'#82947d');tree(x+sx,z-5);}
 landmarkMarkers.push({x,z,type:'W',name:'SUPERCENTER'});
}
function makeStadium(x,z){
 landmarkBase(x,z,'#aaa99e');block(x,.60,z,23,.18,15,'#6f9c72');
 // Four grounded stepped grandstands around a central pitch.
 for(let tier=0;tier<4;tier++){const y=.75+tier*.72,hh=.62,off=9.0+tier*.72;block(x,y,z+off,27-tier*1.0,hh,2.4,'#8d9590');block(x,y,z-off,27-tier*1.0,hh,2.4,'#8d9590');}
 for(let tier=0;tier<4;tier++){const y=.75+tier*.72,off=14.0+tier*.55;block(x+off,y,z,2.4,.62,16-tier*.6,'#858e8a');block(x-off,y,z,2.4,.62,16-tier*.6,'#858e8a');}
 // Flood-light towers rooted into the corners.
 for(const sx of [-1,1])for(const sz of [-1,1]){block(x+sx*15.2,6.0,z+sz*15.2,.24,11.2,.24,'#46595b');block(x+sx*14.4,11.1,z+sz*15.2,1.9,.20,.40,'#e9e0b7');}
 landmarkMarkers.push({x,z,type:'S',name:'STADIUM'});
}
function makeHospital(x,z){
 landmarkBase(x,z,'#b8b7ad');const c='#d8ddd8';
 // Three connected masses; each has its own solid footprint.
 for(const spec of [[x,z,13,31,12],[x-9,z,13,18,8],[x+9,z,13,18,8]]){const [bx,bz,w,d,h]=spec;solids.push({x:bx,z:bz,w:w/2,d:d/2});block(bx,h/2+.44,bz,w,h,d,c);cityWindowRows(bx,bz,w,d,3.0,h-.3,3.0);rooftopKit(bx,bz,w,d,h+.44,'slab');}
 const front=z-15.6;block(x,2.15,front,10,3.2,.16,'#446d76');block(x,3.95,front-.75,13,.20,1.55,'#d9ddd2');for(const sx of [-5,5])block(x+sx,1.9,front-.82,.18,3.5,.18,'#69736f');
 // Rooftop helipad H is physically on the roof.
 block(x,12.76,z,8,.10,8,'#a8aaa5');block(x,12.84,z,1.0,.07,5.5,'#f2f2df');block(x,12.84,z,5.0,.07,1.0,'#f2f2df');
 // Red cross on front wall.
 block(x,6.2,z-15.58,1.1,4.2,.12,'#d5585e');block(x,6.2,z-15.66,4.2,1.1,.12,'#d5585e');
 landmarkMarkers.push({x,z,type:'H',name:'HOSPITAL'});
}
function makeMall(x,z){
 landmarkBase(x,z,'#b9b8ad');const c='#c9c6ba';
 for(const [bx,bz,w,d,h] of [[x-9,z,16,30,8],[x+9,z,16,30,8],[x,z-1,8,22,12]]){solids.push({x:bx,z:bz,w:w/2,d:d/2});block(bx,h/2+.44,bz,w,h,d,c);cityWindowRows(bx,bz,w,d,3.0,h-.4,3.2);}
 block(x,4.1,z-15.2,13,6.7,.18,'#456f78');block(x,4.1,z-15.30,11.5,5.9,.035,'#84b2b4');
 block(x,8.65,z,11,.18,20,'#d7d4c8');
 landmarkMarkers.push({x,z,type:'M',name:'MALL'});
}
function makeParkingGarage(x,z){
 landmarkBase(x,z,'#aaa99f');const w=30,d=30,floors=5,slab='#a7aaa5';solids.push({x,z,w:w/2,d:d/2});
 for(let f=0;f<floors;f++){const y=.65+f*2.75;block(x,y,z,w,.24,d,slab);for(const sx of [-1,1])for(const sz of [-1,1])block(x+sx*13,y+1.25,z+sz*13,.38,2.55,.38,'#777f7b');
  block(x-14.6,y+1.28,z,.30,2.48,d-.8,'#858c88');block(x+14.6,y+1.28,z,.30,2.48,d-.8,'#858c88');}
 // Stair-step ramp stays supported by the floor slabs.
 for(let n=0;n<8;n++)block(x-5+n*1.35,1.15+n*.31,z+7,1.5,.26,5.0,'#8d918c');
 landmarkMarkers.push({x,z,type:'P',name:'PARKING'});
}
function makeHotel(x,z){
 landmarkBase(x,z,'#b5b4a9');const w=25,d=22,h=43,c='#a8b7b6';addCityBuilding(x,z+2,w,d,h,c,'slab');
 // Porte-cochere with columns reaching ground.
 const front=z-9.7;block(x,3.15,front,15,.22,4.6,'#d5d2c4');for(const sx of [-6,6])for(const zz of [-1,1])block(x+sx,1.70,front+zz*1.8,.20,2.9,.20,'#626c68');
 landmarkMarkers.push({x,z,type:'T',name:'HOTEL'});
}
function makeTransitHub(x,z){
 landmarkBase(x,z,'#aaa99d');const hallZ=z+9;solids.push({x,z:hallZ,w:15,d:7});block(x,3.7,hallZ,30,6.5,14,'#b9beb8');block(x,3.0,hallZ-7.05,18,4.2,.16,'#4f777e');
 for(const px of [-9,0,9]){block(x+px,.58,z-7,6,.10,25,'#777d78');block(x+px,3.0,z-7,5.2,.18,23,'#d2d0c4');for(const pz of [-16,-7,2])block(x+px,1.75,z+pz,.18,2.7,.18,'#596460');}
 landmarkMarkers.push({x,z,type:'R',name:'TRANSIT'});
}
function makeMuseum(x,z){
 landmarkBase(x,z,'#b5b3a8');solids.push({x,z,w:15,d:13});block(x,4.3,z,30,7.6,26,'#d3cfbf');
 // Grounded colonnade and stepped entrance.
 for(let k=-5;k<=5;k++)block(x+k*2.2,2.8,z-13.4,.32,4.8,.32,'#8a8c82');
 for(let step=0;step<4;step++)block(x,.55+step*.18,z-16.0+step*.65,23-step*1.2,.18,1.0,'#bdb9aa');
 block(x,8.5,z,19,.50,19,'#b3afa2');rooftopKit(x,z,19,19,8.75,'civic');
 landmarkMarkers.push({x,z,type:'U',name:'MUSEUM'});
}
function makeUniversity(x,z){
 landmarkBase(x,z,'#b8b5aa');for(const [bx,bz,w,d,h] of [[x-10,z+7,14,18,10],[x+10,z+7,14,18,10],[x,z-10,28,12,7]]){solids.push({x:bx,z:bz,w:w/2,d:d/2});block(bx,h/2+.44,bz,w,h,d,'#b99272');cityWindowRows(bx,bz,w,d,3.0,h-.3,3.0);rooftopKit(bx,bz,w,d,h+.44,'mid');}
 block(x,.55,z+3,12,.12,12,'#7f9c7c');tree(x-4,z+3);tree(x+4,z+3);landmarkMarkers.push({x,z,type:'C',name:'CAMPUS'});
}
function makePoliceHQ(x,z){
 landmarkBase(x,z,'#a9aaa2');solids.push({x,z,w:14,d:12});block(x,7.0,z,28,13.2,24,'#87999d');cityWindowRows(x,z,28,24,3.0,12.6,3.1);rooftopKit(x,z,28,24,13.65,'slab');
 block(x,2.0,z-12.15,11,3.0,.16,'#304f58');block(x,3.9,z-12.50,14,.20,.9,'#c8cbc1');for(const sx of [-5.8,5.8])block(x+sx,1.9,z-12.55,.18,3.5,.18,'#5d6763');
 landmarkMarkers.push({x,z,type:'D',name:'POLICE HQ'});
}
const LANDMARK_CELLS=new Map([
 ['4,15','walmart'],['15,5','stadium'],['10,15','hospital'],['13,10','mall'],['6,9','parking'],
 ['9,6','hotel'],['16,12','university'],['3,7','transit'],['12,17','museum'],['17,8','police'],
 // World landmarks modelled from photographic silhouette references.
 ['7,7','eiffel'],['10,10','burj'],['11,9','taipei101'],['8,11','petronas'],
 ['2,15','opera'],['9,11','empire'],['4,4','bigben'],['15,15','mbs']
]);
function makeLandmark(kind,x,z){
 if(kind==='walmart')return makeWalmart(x,z);if(kind==='stadium')return makeStadium(x,z);if(kind==='hospital')return makeHospital(x,z);
 if(kind==='mall')return makeMall(x,z);if(kind==='parking')return makeParkingGarage(x,z);if(kind==='hotel')return makeHotel(x,z);
 if(kind==='university')return makeUniversity(x,z);if(kind==='transit')return makeTransitHub(x,z);if(kind==='museum')return makeMuseum(x,z);if(kind==='police')return makePoliceHQ(x,z);
 if(kind==='eiffel')return makeEiffelTower(x,z);if(kind==='burj')return makeBurjKhalifa(x,z);if(kind==='taipei101')return makeTaipei101(x,z);if(kind==='petronas')return makePetronas(x,z);
 if(kind==='opera')return makeSydneyOperaHouse(x,z);if(kind==='empire')return makeEmpireState(x,z);if(kind==='bigben')return makeBigBen(x,z);if(kind==='mbs')return makeMarinaBaySands(x,z);
}
function districtFor(i,j){
 const c=(GRID_SECTORS-1)/2,dx=i-c,dz=j-c,r=Math.hypot(dx,dz);
 if(r<3.4)return 'core';
 if(i>c+3.1&&j>c+2.0)return 'wealthy';
 if(i<c-4.2&&j<c-3.0)return 'oldtown';
 if(i<2.5||j>GRID_SECTORS-3.0)return 'industrial';
 if(r<6.8)return 'mixed';
 return 'quiet';
}
function addOfficeTower(x,z){
 const w=rand(27,35),d=rand(27,35),h=rand(45,76),c=choice(['#4f91a8','#5b9b94','#6d8fb2','#7d88ad','#789c7f','#9a7f91','#648b9b']);
 addCityBuilding(x,z,w,d,h,c,'tower');
 // Double-height glass lobby and a restrained, attached crown.
 const front=z+d/2+.10;block(x,2.15,front,w*.64,3.25,.12,'#315761');block(x,2.15,front+.075,w*.56,2.78,.035,'#74a4aa');
 for(let k=-3;k<=3;k++)block(x+k*w*.08,2.18,front+.13,.075,3.0,.055,'#c5d5d2');
 block(x,h+1.20,z,w*.62,.22,d*.62,shadeHex(c,.74));
}
for(let i=0;i<GRID_SECTORS;i++)for(let j=0;j<GRID_SECTORS;j++){
 batchZone='s'+i+'_'+j;
 const x=(roadLines[i]+roadLines[i+1])/2,z=(roadLines[j]+roadLines[j+1])/2,district=districtFor(i,j);
 block(x,.12,z,38,.5,38,district==='core'?'#a8ada5':district==='wealthy'?'#bdc4ad':district==='oldtown'?'#a99d8d':'#c1bbaa');block(x,.39,z,36,.08,36,district==='wealthy'?'#b6c7aa':'#aab795');
 const landmarkKind=LANDMARK_CELLS.get(i+','+j);if(landmarkKind){makeLandmark(landmarkKind,x,z);continue;}
 if(FUEL_STATION_CELLS.has(i+','+j)){makeFuelStation(x,z);continue;}
 const r=seeded();
 if((district==='wealthy'&&r<.16)||(district==='quiet'&&r<.11)||(district==='mixed'&&r<.07)){makePark(x,z);continue;}
 if(district==='core'){
  if(r<.66)addOfficeTower(x+rand(-1,1),z+rand(-1,1));else{const vertical=seeded()>.5;for(const side of [-1,1])addCityBuilding(x+(vertical?side*9.2:0),z+(vertical?0:side*9.2),vertical?14:31,vertical?31:14,rand(24,45),choice(['#829aa3','#a38f8b','#778f91']),'slab');}
 }else if(district==='wealthy'){
  if(r<.62)addLuxuryResidence(x,z);else{for(const a of [-1,1])for(const b of [-1,1]){const bx=x+a*8.8,bz=z+b*8.8;addCityBuilding(bx,bz,rand(11,14),rand(11,14),rand(6,12),choice(['#d7d0c3','#bcc8bd','#d6c0b4']),'low');}tree(x-16,z);tree(x+16,z);}
 }else if(district==='oldtown'){
  if(r<.20)addConvenienceStore(x,z);else{for(const a of [-1,1])for(const b of [-1,1])addOldWalkup(x+a*9+rand(-.7,.7),z+b*9+rand(-.7,.7));}
 }else if(district==='industrial'){
  if(r<.18)addConvenienceStore(x,z);else addCityBuilding(x,z,rand(32,36),rand(31,36),rand(5.5,10),choice(['#8d9690','#a28f80','#7f8d8d']),'warehouse');
 }else if(district==='quiet'){
  if(r<.17)addConvenienceStore(x,z);else{for(const a of [-1,1])for(const b of [-1,1]){const bx=x+a*8.8,bz=z+b*8.8;addCityBuilding(bx,bz,rand(11,15),rand(10,14),rand(5,11),choice(['#d8c4a8','#a9b9a8','#c4ad9d','#b7c1c9']),'low');}if(seeded()>.2){tree(x-16,z-13);tree(x+16,z+13);}}
 }else{
  if(r<.12)addConvenienceStore(x,z);else if(r<.27)addOfficeTower(x,z);else{for(const a of [-1,1])for(const b of [-1,1]){const roll=seeded(),style=roll>.78?'stepped':roll>.55?'slab':'mid',h=style==='stepped'?rand(16,28):style==='slab'?rand(14,24):rand(9,18);addCityBuilding(x+a*8.8+rand(-1,1),z+b*8.8+rand(-1,1),rand(10,14.5),rand(10,14.5),h,choice(facades),style);}}
 }
}
batchZone='global';
const streetLightPositions=[];
for(let i=1;i<GRID_SECTORS;i+=2)for(let j=1;j<GRID_SECTORS;j+=2){const x=roadLines[i]+11,z=roadLines[j]+11;block(x,3.15,z,.16,6.3,.16,'#3d5a5d');block(x-1.05,6.22,z,2.25,.16,.2,'#3d5a5d');block(x-1.85,6.08,z,.62,.13,.42,'#f4ddb0');streetLightPositions.push({x:x-1.85,y:6.08,z});}
const NO_SHADOW_COLORS=new Set(['#304b53','#263e46','#e5cf9e','#85a8a3','#d7c9aa','#718e8b','#e6e0c8','#557c86','#e7c88e']);
for(const [key,list] of batches){
 const split=key.indexOf('|'),zone=key.slice(0,split),c=key.slice(split+1),inst=new THREE.InstancedMesh(boxGeo,mat(c),list.length);
 for(let i=0;i<list.length;i++){const [x,y,z,w,h,d,r]=list[i];dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,r,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}
 inst.castShadow=zone!=='global'&&!NO_SHADOW_COLORS.has(c);inst.receiveShadow=true;inst.frustumCulled=true;
 // Critical for the 20x20 map: each block is its own render chunk. This lets Three.js
 // discard off-screen districts instead of drawing the entire city every frame.
 if(zone[0]==='s'){
  const parts=zone.slice(1).split('_'),si=Number(parts[0]),sj=Number(parts[1]);
  inst.userData.cityChunk=true;inst.userData.chunkX=(roadLines[si]+roadLines[si+1])/2;inst.userData.chunkZ=(roadLines[sj]+roadLines[sj+1])/2;cityChunks.push(inst);
 }
 inst.computeBoundingBox();inst.computeBoundingSphere();inst.updateMatrix();inst.matrixAutoUpdate=false;scene.add(inst);
}
batches.clear();
// Night road lighting: emissive lamp heads plus a small moving pool of real point lights.
const streetLampMat=new THREE.MeshStandardMaterial({color:'#f8e7b3',roughness:.35,metalness:.05,emissive:'#ffd36b',emissiveIntensity:0});
const streetLampMesh=new THREE.InstancedMesh(boxGeo,streetLampMat,streetLightPositions.length);for(let i=0;i<streetLightPositions.length;i++){const p=streetLightPositions[i];dummy.position.set(p.x,p.y,p.z);dummy.scale.set(.72,.18,.50);dummy.updateMatrix();streetLampMesh.setMatrixAt(i,dummy.matrix);}streetLampMesh.instanceMatrix.needsUpdate=true;streetLampMesh.castShadow=false;streetLampMesh.receiveShadow=false;scene.add(streetLampMesh);
const roadLightPool=Array.from({length:6},()=>{const l=new THREE.PointLight('#ffd889',0,27,2);l.position.y=5.75;l.castShadow=false;scene.add(l);return l;});

// Weather rendering: one cloud instanced mesh and one precipitation point field keep draw calls low.
const cloudGeo=new THREE.SphereGeometry(1,8,5),cloudMat=new THREE.MeshLambertMaterial({color:'#f4f5f3',transparent:true,opacity:0,depthWrite:false,fog:true});
const CLOUD_PARTS=168,cloudMesh=new THREE.InstancedMesh(cloudGeo,cloudMat,CLOUD_PARTS);let cloudSeed=9127;const cloudRand=()=>{cloudSeed=(cloudSeed*1664525+1013904223)>>>0;return cloudSeed/4294967296;};for(let i=0;i<CLOUD_PARTS;i++){const cluster=Math.floor(i/4),part=i%4,a=cloudRand()*TAU,r=70+cloudRand()*300,cx=Math.cos(a)*r,cz=Math.sin(a)*r,cy=58+cloudRand()*56;dummy.position.set(cx+(part-1.5)*4.8,cy+cloudRand()*3,cz+(cloudRand()-.5)*9);dummy.scale.set(8+cloudRand()*8,2.5+cloudRand()*4.5,5+cloudRand()*10);dummy.updateMatrix();cloudMesh.setMatrixAt(i,dummy.matrix);}cloudMesh.instanceMatrix.needsUpdate=true;cloudMesh.frustumCulled=false;cloudMesh.renderOrder=-2;scene.add(cloudMesh);
const PRECIP_COUNT=900,precipPositions=new Float32Array(PRECIP_COUNT*3);for(let i=0;i<PRECIP_COUNT;i++){precipPositions[i*3]=rand(-48,48);precipPositions[i*3+1]=rand(2,64);precipPositions[i*3+2]=rand(-48,48);}const precipGeo=new THREE.BufferGeometry();precipGeo.setAttribute('position',new THREE.BufferAttribute(precipPositions,3));const precipMat=new THREE.PointsMaterial({color:'#c8dce8',size:.16,transparent:true,opacity:.78,depthWrite:false});const precip=new THREE.Points(precipGeo,precipMat);precip.visible=false;precip.frustumCulled=false;scene.add(precip);
const lightningGeo=new THREE.BufferGeometry(),lightningPts=new Float32Array(27);lightningGeo.setAttribute('position',new THREE.BufferAttribute(lightningPts,3));const lightningBolt=new THREE.Line(lightningGeo,new THREE.LineBasicMaterial({color:'#eef6ff',transparent:true,opacity:0,depthTest:false}));lightningBolt.visible=false;lightningBolt.renderOrder=20;scene.add(lightningBolt);

const TYPES={
 coupe:{name:'STINGER',w:1.9,l:3.9,h:.66,max:36,acc:25,turn:1.88,grip:7,hp:220,mass:1,color:'#ef929b'},
 hatch:{name:'ZIP',w:1.8,l:3.2,h:.86,max:31,acc:27,turn:2.3,grip:9,hp:195,mass:.82,color:'#a3ddd0'},
 muscle:{name:'BRUISER',w:2.1,l:4.4,h:.72,max:33,acc:21,turn:1.65,grip:5.8,hp:330,mass:1.65,color:'#f5d278'},
 taxi:{name:'FARE GAME',w:1.95,l:4.1,h:.82,max:31,acc:22,turn:1.85,grip:7,hp:235,mass:1.1,color:'#edc75c'},
 van:{name:'BOX OFFICE',w:2.25,l:4.7,h:1.38,max:27,acc:17,turn:1.5,grip:7,hp:360,mass:1.9,color:'#e4e4cf'},
 truck:{name:'HEAVY METAL',w:2.5,l:6.1,h:1.55,max:23,acc:14,turn:1.25,grip:6,hp:480,mass:2.8,color:'#e59c76'},
 bus:{name:'ALL ABOARD',w:2.5,l:7.4,h:1.4,max:24,acc:13,turn:1.14,grip:6,hp:520,mass:3.2,color:'#96bfc2'},
 sedan:{name:'CRUISER',w:1.92,l:4.35,h:.82,max:32,acc:21,turn:1.82,grip:7.4,hp:255,mass:1.25,color:'#9bb6d1'},
 wagon:{name:'LONGHAUL',w:1.98,l:4.65,h:1.02,max:30,acc:19,turn:1.7,grip:7.6,hp:285,mass:1.42,color:'#9ab48b'},
 roadster:{name:'FLASH',w:1.84,l:3.72,h:.55,max:39,acc:29,turn:2.08,grip:8.2,hp:190,mass:.88,color:'#8fd4ff'},
 pickup:{name:'MULE',w:2.18,l:5.0,h:1.08,max:29,acc:20,turn:1.58,grip:6.6,hp:390,mass:1.9,color:'#d8a26e'},
 minivan:{name:'FAMILY PLAN',w:2.08,l:4.75,h:1.35,max:27,acc:17.5,turn:1.56,grip:7.4,hp:330,mass:1.72,color:'#c0b5d3'},
 delivery:{name:'COURIER',w:2.26,l:5.25,h:1.62,max:25,acc:16,turn:1.42,grip:6.8,hp:400,mass:2.15,color:'#dfd8bf'},
 limo:{name:'STRETCH',w:2.02,l:6.0,h:.86,max:29,acc:16.5,turn:1.3,grip:6.4,hp:345,mass:2.1,color:'#738087'},
 micro:{name:'PEBBLE',w:1.62,l:2.75,h:1.03,max:27,acc:25,turn:2.55,grip:9.4,hp:150,mass:.67,color:'#ef9fc2'},
 sports:{name:'RAZOR',w:1.96,l:4.15,h:.58,max:40,acc:28,turn:2.0,grip:8.4,hp:215,mass:1.0,color:'#ff8d63'},
 ferrari:{name:'FERRARI',w:2.02,l:4.65,h:.50,max:69.4444,acc:39,turn:1.9,grip:9.25,hp:175,mass:1.18,boost:15,color:'#ef3038'},
 motorbike:{name:'APEX MOTO',w:.82,l:2.18,h:.88,max:61.1111,acc:37,turn:2.72,grip:9.1,hp:92,mass:.34,boost:14,color:'#f0eee2'},
 f1:{name:'F1',w:2.02,l:5.15,h:.42,max:83.3333,acc:52,turn:2.05,grip:11.4,hp:145,mass:.78,boost:20,color:'#ff4b4f'},
 classic:{name:'VINTAGE',w:2.0,l:4.75,h:.88,max:28,acc:18,turn:1.55,grip:6.1,hp:300,mass:1.52,color:'#85b8a0'},
 armored:{name:'BASTION',w:2.62,l:5.65,h:1.58,max:19.4444,acc:10.5,turn:1.08,grip:6.7,hp:950,mass:4.65,boost:8.3333,color:'#66756f'},
 cop:{name:'INTERCEPTOR',w:2,l:4.3,h:.8,max:35,acc:24,turn:1.95,grip:8,hp:285,mass:1.4,color:'#e7e9d7'},
 suv:{name:'ENFORCER',w:2.3,l:4.7,h:1.16,max:31,acc:21,turn:1.75,grip:8,hp:410,mass:2.25,color:'#49616b'},
}
// Global durability rebalance: every vehicle survives longer while preserving class differences.
const DURABILITY_SCALE={motorbike:1.18,f1:1.24,ferrari:1.28,roadster:1.30,sports:1.32,micro:1.30,hatch:1.34,coupe:1.36,sedan:1.38,wagon:1.38,taxi:1.38,classic:1.38,muscle:1.42,minivan:1.42,van:1.44,delivery:1.46,pickup:1.48,limo:1.44,truck:1.50,bus:1.50,cop:1.42,suv:1.46,armored:1.22};
for(const [type,spec] of Object.entries(TYPES))spec.hp=Math.round(spec.hp*(DURABILITY_SCALE[type]||1.38)/5)*5;
const FUEL_DISTANCE_SCALE=10;
function calculateFuelSpec(type,s){
 // Fuel economy is intentionally differentiated by vehicle class instead of converging to one range.
 // Small/light cars are genuinely economical; heavy/high-performance vehicles pay for mass and power.
 const profiles={
  micro:[34,4.2,58],hatch:[45,5.2,66],coupe:[52,6.6,74],sedan:[55,6.5,76],wagon:[60,7.0,72],taxi:[58,7.2,70],
  minivan:[66,8.2,66],van:[74,9.4,64],delivery:[92,11.8,62],pickup:[86,11.6,66],muscle:[70,12.6,72],
  roadster:[50,7.7,78],sports:[62,10.5,82],classic:[62,9.3,66],motorbike:[18,3.5,70],ferrari:[78,14.5,92],f1:[110,42,118],
  truck:[180,25,68],bus:[240,32,62],armored:[190,30,56],cop:[65,9.5,78],suv:[90,12.5,68]
 };
 if(profiles[type]){const [tank,baseL100,optimalKph]=profiles[type];const reserveMeters=clamp(55+240/baseL100+s.mass*10,58,125);return {tank,baseL100,optimalKph,reserveMeters:Math.round(reserveMeters)};}
 // Fallback keeps future vehicle additions logical: weight dominates, then aero/performance.
 const maxKph=s.max*3.6,mass=Math.max(.3,s.mass),frontal=s.w*Math.max(.55,s.h);
 const performance=Math.max(0,maxKph-105)*.012+Math.max(0,s.acc-18)*.055;
 const tank=clamp(30+mass*13+s.l*2,30,180);
 const baseL100=clamp(3.2+mass*1.7+frontal*.28+performance,4,26);
 const optimalKph=clamp(78-mass*4+Math.min(10,Math.max(0,maxKph-140)*.05),52,92);
 const reserveMeters=clamp(55+240/baseL100+mass*10,58,125);
 return {tank:Number(tank.toFixed(1)),baseL100:Number(baseL100.toFixed(1)),optimalKph:Math.round(optimalKph),reserveMeters:Math.round(reserveMeters)};
}
for(const [type,s] of Object.entries(TYPES))s.fuel=calculateFuelSpec(type,s);
const TRAFFIC_TYPES=['hatch','coupe','muscle','taxi','van','truck','bus','sedan','wagon','roadster','pickup','minivan','delivery','limo','micro','sports','classic','motorbike'];
function randomTrafficType(){const r=Math.random();if(r<.0010)return 'f1';if(r<.0045)return 'ferrari';if(r<.0055)return 'armored';if(r<.0200)return 'sports';return choice(TRAFFIC_TYPES);}
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
const vrMotoTireGeo=new THREE.TorusGeometry(.39,.095,8,20),vrMotoRimGeo=new THREE.TorusGeometry(.39,.025,6,20),vrTubeGeo=new THREE.CylinderGeometry(.045,.045,1,8),vrTankGeo=new THREE.SphereGeometry(1,16,10);
function vrPart(parent,geo,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function vrBox(parent,x,y,z,w,h,d,material,rx=0,ry=0,rz=0){return vrPart(parent,boxGeo,material,x,y,z,w,h,d,rx,ry,rz);}
function vrGlassBox(parent,x,y,z,w,h,d,rx=0){return vrBox(parent,x,y,z,w,h,d,vrGlass,rx);}
function vrWindowStrip(body,s,mid,len,y,h){for(const side of [-1,1]){vrPart(body,vrSideWindowGeo,vrGlass,side*(s.w*.407),y,mid,.035,h,len*.74);for(const z of [-.26,.26])vrBox(body,side*(s.w*.422),y,mid+z*len,.045,h*.92,.055,vrTrim);}}
function vrFenders(body,s){for(const side of [-1,1])for(const end of [-1,1])vrPart(body,vrFenderGeo,vrTrim,side*s.w*.49,.39,end*s.l*.3,1,1,1,0,Math.PI/2);}
function vrWheels(g,s,wheels){for(const side of [-1,1])for(const end of [-1,1]){const axle=new THREE.Group();axle.position.set(side*s.w*.49,.39,end*s.l*.3);axle.userData.front=end===1;axle.userData.rear=end===-1;axle.userData.baseY=0;g.add(axle);vrPart(axle,vrTireGeo,vrRubber,0,0,0,1,1,1,0,0,Math.PI/2);vrPart(axle,vrRimGeo,vrAlloy,0,0,0,1,1,1,0,0,Math.PI/2);vrPart(axle,vrHubGeo,vrChrome,0,0,0,1,1,1,0,0,Math.PI/2);wheels.push(axle);}}
function vrFerrariBody(body,s,paint){
 const front=s.l*.49,rear=-s.l*.49;
 // Low wedge nose, sculpted rear haunches and black aero floor.
 vrPart(body,vrHullGeo,paint,0,.60,.18,s.w*.98,.32,s.l*.56,0,0,0);
 vrPart(body,vrHullGeo,paint,0,.69,-s.l*.29,s.w*.96,.46,s.l*.31,0,0,0);
 vrBox(body,0,.34,.02,s.w*.96,.10,s.l*.94,vrTrim);
 vrBox(body,0,.44,front-.04,s.w*.91,.08,.34,vrTrim,-.05);
 vrBox(body,0,.43,rear+.03,s.w*.9,.10,.30,vrTrim,.05);
 // Teardrop canopy.
 const cabLen=s.l*.34,cabMid=-.18,cabY=1.01,cabH=.42;
 vrPart(body,vrCabGeo,paint,0,cabY,cabMid,s.w*.70,cabH,cabLen);
 vrGlassBox(body,0,cabY+.015,cabMid+cabLen*.445+.01,s.w*.63,cabH*.78,.04,-.38);
 vrGlassBox(body,0,cabY+.005,cabMid-cabLen*.445-.01,s.w*.59,cabH*.64,.04,.30);
 vrWindowStrip(body,s,cabMid,cabLen,cabY,.25);
 vrBox(body,0,cabY+cabH*.54,cabMid,s.w*.72,.045,cabLen*.96,paint);
 // Side blades, intakes and shoulders.
 for(const side of [-1,1]){
  vrBox(body,side*s.w*.46,.63,-.36,.075,.32,.68,vrTrim,0,0,side*.09);
  vrBox(body,side*s.w*.435,.61,.38,.08,.20,.54,paint,0,0,side*-.05);
  vrBox(body,side*s.w*.39,.77,-.58,.11,.22,.42,vrTrim);
  vrBox(body,side*s.w*.31,.61,front,s.w*.20,.095,.06,vrHead);
  const tail=vrBox(body,side*s.w*.30,.72,rear,s.w*.20,.10,.055,vrTail);tail.userData.lamp=true;
 }
 // Mirrors and rear deck.
 for(const side of [-1,1]){vrBox(body,side*s.w*.45,1.00,.05,.09,.05,.22,vrTrim,0,0,side*.16);vrBox(body,side*s.w*.50,1.02,.10,.18,.09,.13,paint);}
 // Rear deck, diffuser, twin exhausts and subtle wing.
 vrBox(body,0,.83,rear+.30,s.w*.74,.08,.62,paint,.04);
 vrBox(body,0,.43,rear+.06,s.w*.72,.12,.28,vrTrim,.06);for(let k=-2;k<=2;k++)vrBox(body,k*.16,.58,rear+.005,.055,.16,.035,vrChrome);
 for(const side of [-1,1]){vrPart(body,vrHubGeo,vrChrome,side*.32,.48,rear-.035,.58,.58,.58,Math.PI/2,0,0);}
 vrBox(body,0,.92,rear+.16,s.w*.72,.055,.18,vrTrim);
 vrBox(body,-s.w*.33,.82,-.12,.05,.19,.22,vrTrim);vrBox(body,s.w*.33,.82,-.12,.05,.19,.22,vrTrim);
 // Hood channels and center badge line.
 for(const side of [-1,1])vrBox(body,side*.31,.79,.67,.05,.025,.92,vrTrim,0,side*.03,0);
 vrBox(body,0,.80,front-.32,.07,.018,.42,vrChrome);
}
function vrMotorbikeBody(body,s,paint,wheels){
 // Wheels are true torus motorcycle wheels rather than car cylinders.
 for(const end of [-1,1]){const wheel=new THREE.Group();wheel.position.set(0,.47,end*.76);wheel.rotation.y=Math.PI/2;wheel.userData.front=end===1;wheel.userData.rear=end===-1;wheel.userData.baseY=Math.PI/2;body.add(wheel);vrPart(wheel,vrMotoTireGeo,vrRubber,0,0,0,1,1,1);vrPart(wheel,vrMotoRimGeo,vrAlloy,0,0,0,.83,.83,.83);for(let k=0;k<6;k++){const a=k*Math.PI/3;vrBox(wheel,Math.cos(a)*.20,Math.sin(a)*.20,0,.035,.39,.025,vrChrome,0,0,-a);}wheels.push(wheel);}
 // Trellis-like frame.
 vrBox(body,0,.72,0,.16,.16,1.12,vrTrim,-.08);
 for(const side of [-1,1]){vrBox(body,side*.18,.72,.03,.055,.055,1.06,vrChrome,-side*.08,0,side*.18);}
 // Engine block and headers.
 vrBox(body,0,.63,-.02,.46,.42,.48,vrTrim);vrBox(body,0,.63,-.01,.32,.28,.56,vrAlloy);
 for(const side of [-1,1])vrBox(body,side*.18,.49,-.18,.07,.07,.70,vrChrome,.16,0,0);
 // Sculpted fuel tank.
 vrPart(body,vrTankGeo,paint,0,1.02,.03,.40,.30,.52,0,0,0);
 vrBox(body,0,.92,-.47,.42,.16,.62,vrSeat,.08);vrBox(body,0,.86,-.77,.32,.10,.32,vrTrim,.05);
 // Front forks, triple clamp and bars.
 for(const side of [-1,1]){vrBox(body,side*.13,.73,.58,.045,.86,.045,vrChrome,-.17);vrBox(body,side*.34,1.17,.45,.42,.045,.045,vrChrome,0,0,side*.08);vrBox(body,side*.48,1.19,.44,.13,.07,.07,vrRubber);}
 vrBox(body,0,1.11,.48,.36,.08,.18,vrTrim,-.12);
 vrGlassBox(body,0,1.32,.31,.42,.30,.035,-.28);
 // Headlight, tail light, indicators and compact exhaust.
 vrBox(body,0,1.02,.78,.38,.23,.06,vrHead,-.12);const tail=vrBox(body,0,.95,-.88,.28,.12,.055,vrTail);tail.userData.lamp=true;
 for(const side of [-1,1]){vrBox(body,side*.34,1.03,.62,.10,.07,.06,vrAmber);vrBox(body,side*.29,.94,-.72,.10,.07,.06,vrAmber);}
 vrBox(body,.31,.54,-.42,.15,.15,.72,vrChrome,.08);vrBox(body,.32,.55,-.79,.19,.18,.34,vrTrim,.05);
 // Rear swingarm and small plate holder.
 for(const side of [-1,1])vrBox(body,side*.14,.55,-.48,.055,.055,.72,vrAlloy,.10);
 vrBox(body,0,.74,-.96,.30,.025,.23,vrTrim,.14);
}
function vrF1Body(body,s,paint,wheels){
 const front=s.l*.49,rear=-s.l*.49;
 // Carbon floor and plank: very low, wide and visibly separate from the bodywork.
 vrBox(body,0,.28,0,s.w*.86,.08,s.l*.84,vrTrim);
 vrBox(body,0,.32,.08,.62,.10,s.l*.78,paint);
 // Long tapered nose and stepped crash structure.
 vrPart(body,vrHullGeo,paint,0,.43,s.l*.28,.72,.16,s.l*.37);
 vrBox(body,0,.37,front-.16,.34,.12,.68,paint,-.05);
 vrBox(body,0,.34,front+.01,.20,.08,.20,vrTrim);
 // Multi-element front wing with endplates.
 vrBox(body,0,.29,front-.06,s.w*1.03,.045,.26,vrTrim,-.03);
 vrBox(body,0,.35,front-.16,s.w*.91,.035,.18,vrChrome,-.05);
 for(const side of [-1,1]){vrBox(body,side*s.w*.51,.34,front-.12,.045,.34,.33,vrTrim);vrBox(body,side*s.w*.43,.39,front-.20,.27,.035,.15,vrTrim,0,0,side*.05);}
 // Sidepods, undercut and cooling inlets.
 for(const side of [-1,1]){
  vrPart(body,vrHullGeo,paint,side*.49,.48,-.05,.62,.22,1.72,0,0,side*.03);
  vrBox(body,side*.63,.53,.30,.20,.25,.45,vrTrim,0,0,side*.05);
  vrBox(body,side*.58,.44,-.42,.17,.13,.72,vrTrim,0,0,side*-.04);
  vrBox(body,side*.52,.34,-.58,.30,.045,.84,vrTrim);
 }
 // Open cockpit, seat and halo safety structure.
 vrBox(body,0,.55,-.18,.56,.18,.82,vrSeat,-.05);
 vrBox(body,0,.61,-.20,.42,.15,.58,vrGlass,-.08);
 for(const side of [-1,1]){vrBox(body,side*.28,.76,-.10,.045,.45,.045,vrChrome,side*.12);vrBox(body,side*.20,.92,.03,.045,.46,.045,vrChrome,-side*.18);}
 vrBox(body,0,.94,-.02,.48,.045,.045,vrChrome);
 vrBox(body,0,.77,-.20,.045,.37,.045,vrChrome);
 // Airbox / engine cover / shark fin.
 vrPart(body,vrHullGeo,paint,0,.68,-.66,.60,.30,1.46,0,0,0);
 vrBox(body,0,.94,-.48,.32,.38,.38,paint,-.12);
 vrBox(body,0,1.03,-.76,.055,.40,.72,paint,.06);
 vrBox(body,0,.61,rear+.30,.64,.19,.70,paint,.04);
 // Rear suspension links and diffuser.
 for(const side of [-1,1]){vrBox(body,side*.42,.40,rear+.36,.055,.055,.72,vrChrome,side*.10);vrBox(body,side*.41,.53,rear+.34,.05,.05,.62,vrChrome,-side*.11);}
 vrBox(body,0,.28,rear+.10,s.w*.78,.11,.45,vrTrim,.07);
 for(let k=-2;k<=2;k++)vrBox(body,k*.16,.34,rear+.02,.055,.18,.22,vrTrim,.08);
 // Tall two-plane rear wing and DRS-style flap.
 vrBox(body,0,.93,rear+.09,s.w*.92,.055,.30,vrTrim,.04);
 vrBox(body,0,1.03,rear+.04,s.w*.82,.045,.22,vrTrim,.08);
 for(const side of [-1,1])vrBox(body,side*s.w*.43,.78,rear+.08,.045,.52,.31,vrTrim);
 // Rear rain light and exhaust.
 const rain=vrBox(body,0,.47,rear-.02,.16,.10,.05,vrTail);rain.userData.lamp=true;
 vrPart(body,vrHubGeo,vrChrome,0,.58,rear+.20,.62,.62,.62,Math.PI/2,0,0);
 // Four exposed slicks, larger at the rear; rims and hubs stay visible.
 const axleZ=[s.l*.315,-s.l*.30];
 for(let e=0;e<2;e++)for(const side of [-1,1]){
  const isRear=e===1,axle=new THREE.Group();axle.position.set(side*s.w*.49,isRear?.45:.43,axleZ[e]);axle.userData.front=!isRear;axle.userData.rear=isRear;axle.userData.baseY=0;body.add(axle);
  vrPart(axle,vrTireGeo,vrRubber,0,0,0,isRear?1.18:1.05,isRear?1.18:1.05,isRear?1.30:1.14,0,0,Math.PI/2);
  vrPart(axle,vrRimGeo,vrAlloy,0,0,0,isRear?.84:.78,isRear?.84:.78,isRear?.92:.84,0,0,Math.PI/2);
  vrPart(axle,vrHubGeo,vrChrome,0,0,0,.78,.78,.86,0,0,Math.PI/2);wheels.push(axle);
 }
 // Front and rear suspension wishbones.
 for(const side of [-1,1])for(const z of [s.l*.315,-s.l*.30]){vrBox(body,side*.31,.43,z,.06,.045,.72,vrChrome,0,side*.28,side*.07);vrBox(body,side*.32,.57,z,.055,.045,.68,vrChrome,0,-side*.24,-side*.05);}
}
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
 const paint=new THREE.MeshStandardMaterial({color,roughness:type==='ferrari'?.24:type==='f1'?.29:.34,metalness:type==='ferrari'?.48:type==='f1'?.34:.38});
 // One-draw-call distant traffic proxy. Full vehicle geometry is retained and restored nearby;
 // this changes neither traffic density nor spawn cadence.
 const lodProxy=new THREE.Group();
 const lpHull=new THREE.Mesh(vrHullGeo,paint);lpHull.position.set(0,.56,0);lpHull.scale.set(s.w*.96,.48,s.l*.94);lpHull.castShadow=false;lpHull.receiveShadow=true;lpHull.updateMatrix();lpHull.matrixAutoUpdate=false;lodProxy.add(lpHull);
 if(type!=='motorbike'&&type!=='f1'){const lpCab=new THREE.Mesh(vrCabGeo,paint);const tall=['bus','van','minivan','delivery','truck','armored'].includes(type);lpCab.position.set(0,tall?1.05:1.00,-s.l*.08);lpCab.scale.set(s.w*(tall?.88:.72),Math.max(.28,s.h*(tall?.78:.54)),s.l*(tall?.58:.40));lpCab.castShadow=false;lpCab.receiveShadow=true;lpCab.updateMatrix();lpCab.matrixAutoUpdate=false;lodProxy.add(lpCab);}lodProxy.visible=false;g.add(lodProxy);
 const specialBike=type==='motorbike',specialFerrari=type==='ferrari',specialF1=type==='f1',specialArmored=type==='armored';
 const wheels=[];
 if(specialBike){
  vrMotorbikeBody(body,s,paint,wheels);
 }else if(!specialFerrari&&!specialF1){
  vrPart(body,vrHullGeo,paint,0,.58,0,s.w*.96,.5,s.l*.94);vrBox(body,0,.34,0,s.w*.84,.13,s.l*.9,vrTrim);vrBox(body,0,.78,0,s.w*.9,.11,s.l*.88,vrBelt);
 }
 if(type==='ferrari'){
  vrFerrariBody(body,s,paint);
 }else if(specialF1){
  vrF1Body(body,s,paint,wheels);
 }else if(specialBike){
  // Dedicated motorcycle body is complete; skip all car cabin branches.
 }else if(type==='truck'){
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
 }else if(type==='armored'){
  const cabLen=s.l*.54,cabMid=-.10,cabY=1.35,cabH=1.28;
  // Heavy, slab-sided armoured shell: smaller glass area, thicker side armour, deep bumpers and roof plating.
  vrPart(body,vrCabGeo,paint,0,cabY,cabMid,s.w*.94,cabH,cabLen);
  vrGlassBox(body,0,cabY+.08,cabMid+cabLen*.445+.012,s.w*.50,.31,.055,-.12);
  vrWindowStrip(body,s,cabMid,cabLen,cabY+.02,.24);
  vrBox(body,0,.89,s.l*.34,s.w*.94,.48,s.l*.26,paint);vrBox(body,0,.82,-s.l*.35,s.w*.96,.52,s.l*.27,paint);
  vrBox(body,0,.47,s.l*.47,s.w*1.02,.28,.34,vrTrim);vrBox(body,0,.47,-s.l*.47,s.w*1.02,.30,.36,vrTrim);
  for(const side of [-1,1]){
   vrBox(body,side*s.w*.485,.96,0,.20,.92,s.l*.76,vrTrim);
   vrBox(body,side*s.w*.455,1.08,0,.16,.68,s.l*.69,paint);
   vrBox(body,side*s.w*.39,1.30,.40,.28,.30,.40,vrTrim);
   vrBox(body,side*s.w*.50,.50,0,.13,.34,s.l*.86,vrTrim);
  }
  vrBox(body,0,2.08,-.30,1.02,.22,.96,vrTrim);vrBox(body,0,2.20,-.30,.24,.38,.24,vrTrim);
  vrBox(body,0,1.98,.34,s.w*.62,.10,.58,paint);
 }else if(type==='pickup'){
  const cabLen=s.l*.4,cabMid=s.l*.13,cabY=1.1,cabH=.82;vrPart(body,vrCabGeo,paint,0,cabY,cabMid,s.w*.82,cabH,cabLen);vrGlassBox(body,0,cabY+.03,cabMid+cabLen*.445+.012,s.w*.7,cabH*.62,.045,-.24);vrWindowStrip(body,s,cabMid,cabLen,cabY,.42);vrBox(body,0,.79,-s.l*.29,s.w*.86,.42,s.l*.37,paint);vrBox(body,0,1.0,-s.l*.29,s.w*.72,.05,s.l*.29,vrTrim);vrBox(body,0,.86,s.l*.37,s.w*.8,.12,s.l*.17,paint);
 }else{
  const cabLen=type==='hatch'||type==='micro'?s.l*.58:type==='suv'||type==='wagon'?s.l*.6:type==='limo'?s.l*.55:type==='roadster'||type==='sports'?s.l*.42:s.l*.49,cabMid=type==='hatch'||type==='micro'?-.1:type==='wagon'?-.28:type==='limo'?-.32:type==='roadster'||type==='sports'?.02:-.16,cabY=1.04+s.h*.16,cabH=s.h*(type==='roadster'||type==='sports'?.58:.75);
  const hoodLen=type==='coupe'||type==='muscle'?.34:.3;vrBox(body,0,.87,s.l*.31,s.w*.82,.15,s.l*hoodLen,paint);vrBox(body,0,.86,-s.l*.35,s.w*.78,.13,s.l*.22,paint);
   vrPart(body,vrCabGeo,paint,0,cabY,cabMid,s.w*.81,cabH,cabLen);vrGlassBox(body,0,cabY+.03,cabMid+cabLen*.445+.012,s.w*.72,cabH*.67,.045,-.3);vrGlassBox(body,0,cabY+.02,cabMid-cabLen*.445-.012,s.w*.7,cabH*.62,.045,.25);vrWindowStrip(body,s,cabMid,cabLen,cabY,.48*cabH);
  vrBox(body,0,cabY+cabH*.55,cabMid,s.w*.84,.08,cabLen*.98,paint);vrBox(body,0,.83,0,s.w*.94,.06,s.l*.72,vrChrome);
  if(type==='coupe'||type==='muscle'){vrBox(body,0,.98,s.l*.33,.32,.025,s.l*.22,vrSeat);vrBox(body,0,1.02,-s.l*.39,s.w*.86,.08,.24,vrTrim);}
 }
  const lamps=[];
 if(!specialBike&&!specialF1){if(!specialFerrari)vrDetails(body,s,type,paint);vrFenders(body,s);vrWheels(g,s,wheels);}
 body.traverse(o=>{if(o.isMesh){if(o.userData.lamp)lamps.push(o);o.updateMatrix();o.matrixAutoUpdate=false;}});for(const axle of wheels)axle.traverse(o=>{if(o!==axle&&o.isMesh){o.updateMatrix();o.matrixAutoUpdate=false;}});
 let lights=null;if(type==='cop'||type==='suv'){const red=vrBox(body,-.42,1.17+s.h*.8,0,.62,.16,.34,vrPoliceRed);const blue=vrBox(body,.42,1.17+s.h*.8,0,.62,.16,.34,vrPoliceBlue);lights=[red,blue];}
 const initialFuelRatio=role==='player'?rand(.82,.96):role==='cop'||role==='block'?rand(.72,1):rand(.35,1);const v={id:nextId++,type,s,g,body,lodProxy,paint,lamps,wheels,lights,x,z,a,px:x,pz:z,pa:a,collisionPoints:[{x,z},{x,z},{x,z}],vx:0,vz:0,hp:s.hp,fuelMax:s.fuel.tank,fuel:s.fuel.tank*initialFuelRatio,fuelReserve:s.fuel.reserveMeters,fuelEmpty:false,lastFuelUse:0,role,route,wp:0,desired:rand(12,18),echo:0,echoInput:null,input:{t:0,s:0,b:false,q:false},steer:0,drift:0,driftSlip:0,history:[],credit:0,depth:0,hitCD:0,near:false,disabled:false,deadTime:0,swapLock:0,nav:0,navPath:[],lastNode:null,stuck:0};
 vehicles.push(v);syncVehicle(v,0);return v;
}
function removeVehicle(v){scene.remove(v.g);v.paint.dispose();const i=vehicles.indexOf(v);if(i>=0)vehicles.splice(i,1);}
function rectRoute(left,right,top,bottom,reverse=false){
 // Two physically separate lanes: reverse traffic no longer drives head-on in the same lane.
 if(!reverse)return [{x:left+4,z:bottom-4},{x:left+4,z:top+4},{x:right-4,z:top+4},{x:right-4,z:bottom-4}];
 return [{x:left-4,z:bottom+4},{x:right+4,z:bottom+4},{x:right+4,z:top-4},{x:left-4,z:top-4}];
}
function spawnTraffic(anchor=player){
 if(vehicles.length>=132)return null;const near=anchor||{x:0,z:0},node=nodeNear(near.x,near.z);
 for(let attempt=0;attempt<14;attempt++){
  let li=clamp(node.i+Math.floor(rand(-5,2)),0,GRID_SECTORS-1),tj=clamp(node.j+Math.floor(rand(-5,2)),0,GRID_SECTORS-1);
  let ri=Math.min(GRID_SECTORS,li+1+Math.floor(rand(0,6))),bj=Math.min(GRID_SECTORS,tj+1+Math.floor(rand(0,6)));if(ri<=li)ri=Math.min(GRID_SECTORS,li+1);if(bj<=tj)bj=Math.min(GRID_SECTORS,tj+1);
  const route=rectRoute(roadLines[li],roadLines[ri],roadLines[tj],roadLines[bj],Math.random()<.5),n=Math.floor(rand(0,4)),from=route[n],to=route[(n+1)%4],t=Math.random(),x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
  const d0=Math.hypot(x-near.x,z-near.z);if(d0<26||d0>265||vehicles.some(v=>Math.hypot(v.x-x,v.z-z)<10.5))continue;
  const v=createVehicle(randomTrafficType(),x,z,Math.atan2(to.x-from.x,to.z-from.z),'traffic',route);v.wp=(n+1)%4;const nd=nodeNear(x,z),district=districtFor(Math.min(nd.i,GRID_SECTORS-1),Math.min(nd.j,GRID_SECTORS-1));v.desired=district==='core'?rand(7.5,11):district==='quiet'||district==='wealthy'?rand(10.5,15):rand(9,14);v.vx=Math.sin(v.a)*v.desired;v.vz=Math.cos(v.a)*v.desired;return v;
 }
 return null;
}

const particleCount=420,particleMesh=new THREE.InstancedMesh(boxGeo,new THREE.MeshBasicMaterial({vertexColors:false}),particleCount);particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particleMesh.frustumCulled=false;scene.add(particleMesh);
const particles=Array.from({length:particleCount},()=>({life:0}));let particleCursor=0;
for(let i=0;i<particleCount;i++){dummy.position.set(0,-100,0);dummy.scale.setScalar(0);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);particleMesh.setColorAt(i,new THREE.Color());}
function burst(x,z,color,n=14,power=7,y=.6){for(let k=0;k<n;k++){const p=particles[particleCursor];p.x=x;p.y=y;p.z=z;p.vx=rand(-power,power);p.vz=rand(-power,power);p.vy=rand(2,power);p.life=p.total=rand(.3,.9);p.size=rand(.12,.37);p.spin=rand(-5,5);p.smoke=false;particleMesh.setColorAt(particleCursor,new THREE.Color(color));particleCursor=(particleCursor+1)%particleCount;}particleMesh.instanceColor.needsUpdate=true;}
function smoke(v,c='#9da7a0'){const p=particles[particleCursor];Object.assign(p,{x:v.x+rand(-.5,.5),y:1.2,z:v.z+rand(-.5,.5),vx:rand(-.6,.6),vz:rand(-.6,.6),vy:2.3,life:1.1,total:1.1,size:.45,spin:1,smoke:true});particleMesh.setColorAt(particleCursor,new THREE.Color(c));particleCursor=(particleCursor+1)%particleCount;particleMesh.instanceColor.needsUpdate=true;}

// Dedicated tyre-smoke cloud. Low-poly spheres read as soft, expanding smoke instead of spark/debris cubes.
const driftSmokeCount=260,driftSmokeGeo=new THREE.SphereGeometry(.5,6,4),driftSmokeMat=new THREE.MeshBasicMaterial({color:'#d9ddd7',transparent:true,opacity:.24,depthWrite:false});
const driftSmokeMesh=new THREE.InstancedMesh(driftSmokeGeo,driftSmokeMat,driftSmokeCount);driftSmokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);driftSmokeMesh.frustumCulled=false;scene.add(driftSmokeMesh);
const driftSmoke=Array.from({length:driftSmokeCount},()=>({life:0,drawn:false}));let driftSmokeCursor=0;
for(let i=0;i<driftSmokeCount;i++){dummy.position.set(0,-100,0);dummy.scale.setScalar(0);dummy.updateMatrix();driftSmokeMesh.setMatrixAt(i,dummy.matrix);}
function rearWheelPoints(v){const a=v.a,sn=Math.sin(a),cs=Math.cos(a),rear=v.type==='motorbike'?v.s.l*.35:v.s.l*.30,sides=v.type==='motorbike'?[0]:[-1,1];return sides.map(side=>({x:v.x-sn*rear+cs*side*v.s.w*.43,z:v.z-cs*rear-sn*side*v.s.w*.43}));}
function tyreSmoke(v,intensity=1){const points=rearWheelPoints(v),speed=Math.hypot(v.vx,v.vz),amount=Math.max(1,Math.floor(1+intensity*2.5));for(const point of points)for(let n=0;n<amount;n++){const p=driftSmoke[driftSmokeCursor];Object.assign(p,{x:point.x+rand(-.13,.13),y:.28+rand(0,.12),z:point.z+rand(-.13,.13),vx:v.vx*.055+rand(-.65,.65),vz:v.vz*.055+rand(-.65,.65),vy:rand(.75,1.35)+intensity*.85,life:rand(.9,1.55),total:0,size:rand(.34,.58)*(1+intensity*.75),spin:rand(-2.2,2.2),drawn:true});p.total=p.life;driftSmokeCursor=(driftSmokeCursor+1)%driftSmokeCount;}}
function updateDriftSmoke(dt){let changed=false;for(let i=0;i<driftSmoke.length;i++){const p=driftSmoke[i];if(p.life<=0&&!p.drawn)continue;if(p.life>0){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*1.45);p.vz*=Math.exp(-dt*1.45);p.vy*=Math.exp(-dt*.42);const age=1-clamp(p.life/p.total,0,1),fade=clamp(p.life/.26,0,1),size=p.size*(.65+age*2.05)*fade;dummy.position.set(p.x,p.y,p.z);dummy.scale.set(size*1.16,size*.78,size*1.16);dummy.rotation.set(p.spin*age,age*2.1,p.spin*.35);}else{p.drawn=false;dummy.position.set(0,-100,0);dummy.scale.setScalar(0);}dummy.updateMatrix();driftSmokeMesh.setMatrixAt(i,dummy.matrix);changed=true;}if(changed)driftSmokeMesh.instanceMatrix.needsUpdate=true;}

const skidGeo=new THREE.PlaneGeometry(.18,1.35),skidMat=new THREE.MeshBasicMaterial({color:'#1f3439',transparent:true,opacity:.56,depthWrite:false});
const skidMesh=new THREE.InstancedMesh(skidGeo,skidMat,420);skidMesh.count=0;skidMesh.frustumCulled=false;skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(skidMesh);let skidIndex=0;
function skid(v,intensity=1){const speed=Math.hypot(v.vx,v.vz),trackA=speed>1?Math.atan2(v.vx,v.vz):v.a;for(const point of rearWheelPoints(v)){dummy.position.set(point.x,.071,point.z);dummy.rotation.set(-Math.PI/2,0,-trackA);dummy.scale.set(1,clamp(.72+speed/33+intensity*.35,.85,2.05),1);dummy.updateMatrix();skidMesh.setMatrixAt(skidIndex++%420,dummy.matrix);}skidMesh.count=Math.min(420,skidIndex);skidMesh.instanceMatrix.needsUpdate=true;}
const ringGeo=new THREE.RingGeometry(2.8,3,40),ringMat=new THREE.MeshBasicMaterial({color:'#73fff0',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false});
const playerRing=new THREE.Mesh(ringGeo,ringMat);playerRing.rotation.x=-Math.PI/2;playerRing.material.depthTest=false;playerRing.renderOrder=5;scene.add(playerRing);
const targetRing=new THREE.Mesh(ringGeo,ringMat.clone());targetRing.rotation.x=-Math.PI/2;scene.add(targetRing);
const tetherArray=new Float32Array(39),tetherGeo=new THREE.BufferGeometry();tetherGeo.setAttribute('position',new THREE.BufferAttribute(tetherArray,3));
const tether=new THREE.Line(tetherGeo,new THREE.LineBasicMaterial({color:'#abfff0',transparent:true,opacity:.9,depthTest:false}));tether.frustumCulled=false;tether.renderOrder=10;scene.add(tether);
const waves=Array.from({length:5},()=>{const m=new THREE.Mesh(ringGeo,ringMat.clone());m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);return {m,life:0};});let waveIndex=0;
function wave(v){const w=waves[waveIndex++%waves.length];w.life=1;w.m.position.set(v.x,.15,v.z);w.m.visible=true;}

 let player=null,selected='coupe',state='title',elapsed=0,score=0,heat=0,wanted=1,peakWanted=1,arrest=0,spawnTimer=0,blockTimer=0,gameOverTimer=0,swapCooldown=0,swapTarget=null,swapProgress=0,swapHeldLatch=false,turboCharge=0,turboTime=0,shake=0,flash=0,callout=0,combo=0,comboTime=0,toastTimer=0,lastToastPriority=0,cameraMode='cockpit',cameraYaw=0;
let cityCullTick=0;const CITY_RENDER_RADIUS=245;
// 60 Hz gameplay simulation + interpolation: same game speed, half the AI/collision CPU cost,
// while rendering remains uncapped and can present at 120/144 Hz.
const FIXED_STEP=1/60;
let accumulator=0,renderAlpha=1,hudTick=0,shadowTick=0,shownWanted=0,fpsTime=0,fpsFrames=0;
const INTERNAL_RENDER_W=1920,INTERNAL_RENDER_H=1080;
let streetLightTick=0;
const dbgExt=renderer.getContext().getExtension('WEBGL_debug_renderer_info');
const gpuName=dbgExt?String(renderer.getContext().getParameter(dbgExt.UNMASKED_RENDERER_WEBGL)||''):'';
const physicalPixels=innerWidth*innerHeight*Math.pow(devicePixelRatio||1,2);
const forceP600Fallback=/quadro\s*p600/i.test(gpuName)||physicalPixels>7000000;

 let stats={swaps:0,wrecks:0,distance:0,chain:0,turboUses:0},blocks=[],best=0,muted=false,simTime=0,keys={},particleTick=0,minimapTick=0,worldClockHours=8,nearFuelStation=null,refuelActive=false,currentWeather='clear',weatherHoursLeft=4,lightningTime=0;
 const fpsLabel=document.createElement('span');fpsLabel.className='smallButton';fpsLabel.textContent='— FPS';fpsLabel.title='Measured rendering rate · target 120 FPS';document.querySelector('.topTools').prepend(fpsLabel);
 const HISTORY_KEY='hotswap-history-v1',COIN_KEY='hotswap-coins-v1',HISTORY_LIMIT=12;
 let historyRuns=[],storageWarning='',runPersisted=false,coins=0,lastCoinPayout=0;
 function cleanHistoryRun(run){if(!run||!Number.isFinite(Number(run.score)))return null;const n=(v,max)=>Math.max(0,Math.min(max,Math.floor(Number(v)||0)));return {score:n(run.score,999999999),elapsed:Math.max(0,Math.min(86400,Number(run.elapsed)||0)),swaps:n(run.swaps,999),wrecks:n(run.wrecks,9999),chain:n(run.chain,999),wanted:Math.max(1,Math.min(5,n(run.wanted,5))),date:typeof run.date==='string'?run.date:''};}
 function readPersistent(){try{best=Math.max(0,Math.floor(Number(localStorage.getItem('hotswap-best'))||0));coins=Math.max(0,Math.floor(Number(localStorage.getItem(COIN_KEY))||0));const raw=localStorage.getItem(HISTORY_KEY);if(raw){let parsed;try{parsed=JSON.parse(raw);}catch{storageWarning='LOCAL ARCHIVE DATA INVALID · A NEW RUN WILL REPLACE IT';parsed=null;}const validShape=Array.isArray(parsed)||parsed&&parsed.version===1&&Array.isArray(parsed.runs);if(!validShape&&storageWarning==='')storageWarning='LOCAL ARCHIVE DATA INVALID · A NEW RUN WILL REPLACE IT';const values=Array.isArray(parsed)?parsed:validShape?parsed.runs:[];historyRuns=values.map(cleanHistoryRun).filter(Boolean).slice(0,HISTORY_LIMIT);for(const run of historyRuns)best=Math.max(best,run.score);}}catch{storageWarning='LOCAL SAVE UNAVAILABLE · SCORES STAY IN THIS TAB';}}
 function persistRun(){const run={score:Math.floor(score),elapsed:Number(elapsed.toFixed(1)),swaps:stats.swaps,wrecks:stats.wrecks,chain:stats.chain,wanted:peakWanted,date:new Date().toISOString()};historyRuns=[run,...historyRuns].slice(0,HISTORY_LIMIT);best=Math.max(best,run.score);lastCoinPayout=Math.floor(run.score/1000);coins+=lastCoinPayout;try{localStorage.setItem('hotswap-best',String(best));localStorage.setItem(HISTORY_KEY,JSON.stringify({version:1,runs:historyRuns}));localStorage.setItem(COIN_KEY,String(coins));storageWarning='';}catch{storageWarning='LOCAL SAVE UNAVAILABLE · SCORES/COINS STAY IN THIS TAB';}updateCoinDisplay();runPersisted=true;}
 function formatRunTime(seconds){const total=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');}
 function formatRunDate(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'DATE UNKNOWN';}
 function updateCoinDisplay(){if($('coinCount'))$('coinCount').textContent=coins.toLocaleString()+' COINS';}
 function renderHistory(){const bestText='HIGHEST SCORE / '+best.toLocaleString();$('historyBest').textContent=bestText;if($('titleBest'))$('titleBest').textContent=bestText;$('historyStatus').textContent=storageWarning||'SAVED ON THIS DEVICE · LAST 12 RUNS';const list=$('historyList');list.replaceChildren();if(!historyRuns.length){const empty=document.createElement('li');empty.className='historyEmpty';empty.textContent='NO COMPLETED RUNS YET.';list.append(empty);return;}historyRuns.forEach((run,index)=>{const row=document.createElement('li');row.textContent=String(index+1).padStart(2,'0')+' · '+run.score.toLocaleString()+' PTS · '+formatRunTime(run.elapsed)+' · '+run.swaps+' SWAPS · '+run.wrecks+' WRECKS · '+formatRunDate(run.date);list.append(row);});}
 readPersistent();updateCoinDisplay();renderHistory();
const audio=new ChaseAudio();
function notify(main,sub='',priority=1){if(toastTimer>0&&priority<lastToastPriority)return;$('toast').firstElementChild.textContent=main;$('toast').lastElementChild.textContent=sub;$('toast').classList.add('show');toastTimer=2.8;lastToastPriority=priority;}

function resetRun(title=false){
 for(const v of [...vehicles])removeVehicle(v);for(const b of blocks)scene.remove(b.g);blocks=[];
 for(const p of particles){p.life=0;p.drawn=true;}for(const p of driftSmoke){p.life=0;p.drawn=true;}skidMesh.count=0;skidIndex=0;for(const w of waves){w.life=0;w.m.visible=false;}
 accumulator=0;renderAlpha=1;hudTick=1;shadowTick=1;shownWanted=0;fpsTime=fpsFrames=0;fpsLabel.textContent='— FPS';
 elapsed=score=heat=arrest=simTime=swapCooldown=swapProgress=turboCharge=turboTime=shake=flash=callout=combo=comboTime=particleTick=0;worldClockHours=8;nearFuelStation=null;refuelActive=false;currentWeather=weightedWeather();weatherHoursLeft=rand(3,6.5);lightningTime=0;wanted=peakWanted=1;spawnTimer=.55;blockTimer=25;swapTarget=null;swapHeldLatch=false;stats={swaps:0,wrecks:0,distance:0,chain:0,turboUses:0};keys={};nextId=0;gameOverTimer=0;runPersisted=false;
 player=createVehicle(selected,4,25,Math.PI,'player',rectRoute(roadLines[MID],roadLines[MID+2],roadLines[MID-2],roadLines[MID+2]));player.wp=1;player.vz=-12;cameraYaw=player.a;setCameraMode(cameraMode);
 const early=createVehicle('taxi',-4,15,Math.PI,'traffic',[{x:-4,z:-54},{x:-54,z:-54},{x:-54,z:54},{x:-4,z:54}]);early.vz=-13;early.desired=13;
 createVehicle('van',4,-12,Math.PI,'traffic',rectRoute(roadLines[MID],roadLines[MID+1],roadLines[MID-2],roadLines[MID+2])).wp=1;
 createVehicle('truck',-54,-25,0,'traffic',rectRoute(roadLines[MID-1],roadLines[MID+1],roadLines[MID-1],roadLines[MID+2])).wp=0;
 for(let i=0;i<240&&vehicles.filter(v=>v.role==='traffic').length<70;i++)spawnTraffic(player);
 state=title?'title':'playing';$('title').classList.toggle('hidden',!title);$('hud').classList.toggle('hidden',title);$('results').classList.add('hidden');$('pause').classList.add('hidden');$('arrest').classList.add('hidden');$('targetLabel').classList.add('hidden');$('toast').classList.remove('show');toastTimer=0;lastToastPriority=0;$('damageEdge').style.opacity=0;visuals(0);
 if(!title){audio.start();audio.effect('start');notify('YOUR NEXT CAR IS ALREADY HERE.','Hold E near another vehicle to hotswap.',3);}
}
 function chargeTurbo(amount){if(state!=='playing'||turboTime>0||!Number.isFinite(amount))return;turboCharge=clamp(turboCharge+amount,0,100);}
 function activateTurbo(){if(state!=='playing'||!player||player.disabled||turboTime>0||turboCharge<100)return false;turboCharge=0;turboTime=3.4;stats.turboUses++;flash=.42;shake=.16;callout=.8;$('callout').textContent='TURBO';audio.effect('turbo');notify('TURBO ENGAGED','3.4 seconds · charge paused while boosting.',4);return true;}
 function clearKeys(){keys={};accumulator=0;fpsTime=fpsFrames=0;}
function formatWorldClock(){const total=Math.floor(((worldClockHours%24)+24)%24*60),h=Math.floor(total/60),m=total%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
const WEATHER={
 // Sky colours are background-only. Vehicle/building/road materials keep their original palette.
 clear:{label:'CLEAR',weight:.36,cloud:.08,daySky:'#86c8f2',duskSky:'#f19a67',nightSky:'#061426',fog:'#b9c6ca',fogNear:260,fogFar:520,speed:1,grip:1,slip:1,precip:null},
 partly:{label:'PARTLY CLOUDY',weight:.22,cloud:.32,daySky:'#94c8e7',duskSky:'#db9878',nightSky:'#091827',fog:'#b9c3c6',fogNear:230,fogFar:490,speed:1,grip:1,slip:1,precip:null},
 cloudy:{label:'CLOUDY',weight:.16,cloud:.58,daySky:'#9dacb6',duskSky:'#a27e78',nightSky:'#101923',fog:'#b2b9bc',fogNear:180,fogFar:390,speed:1,grip:.97,slip:1.04,precip:null},
 overcast:{label:'OVERCAST',weight:.10,cloud:.88,daySky:'#78858d',duskSky:'#746b70',nightSky:'#121820',fog:'#9ea6aa',fogNear:135,fogFar:310,speed:1,grip:.95,slip:1.06,precip:null},
 rain:{label:'RAIN',weight:.085,cloud:.92,daySky:'#60788a',duskSky:'#665f68',nightSky:'#0b1620',fog:'#87959d',fogNear:105,fogFar:245,speed:1.10,grip:.76,slip:1.30,precip:'rain'},
 fog:{label:'DENSE FOG',weight:.045,cloud:.72,daySky:'#b5bec0',duskSky:'#aaa8a7',nightSky:'#263039',fog:'#b8c0c0',fogNear:16,fogFar:88,speed:1,grip:.96,slip:1.04,precip:null},
 snow:{label:'SNOW',weight:.025,cloud:.90,daySky:'#c6d2db',duskSky:'#c4acaa',nightSky:'#1b2734',fog:'#d0d6d8',fogNear:70,fogFar:205,speed:1.20,grip:.58,slip:1.58,precip:'snow'},
 thunderstorm:{label:'THUNDERSTORM',weight:.005,cloud:1,daySky:'#394958',duskSky:'#403f4b',nightSky:'#070e17',fog:'#69757d',fogNear:62,fogFar:175,speed:1,grip:.70,slip:1.40,precip:'rain'}
};
function weightedWeather(){let r=Math.random(),sum=0;for(const [k,w] of Object.entries(WEATHER)){sum+=w.weight;if(r<=sum)return k;}return 'clear';}
function weatherSpec(){return WEATHER[currentWeather]||WEATHER.clear;}
function updateWeather(realDt){
 if(state==='playing'){weatherHoursLeft-=realDt/60;if(weatherHoursLeft<=0){let next=weightedWeather();if(next===currentWeather&&Math.random()<.65)next=weightedWeather();currentWeather=next;weatherHoursLeft=rand(2.5,6.8);notify('WEATHER / '+weatherSpec().label,'Road grip and visibility updated.',2);}}
 const w=weatherSpec();if($('weatherState'))$('weatherState').textContent=w.label;
 cloudMesh.count=Math.max(5,Math.floor(CLOUD_PARTS*(.06+w.cloud*.94)));cloudMesh.position.set(player?player.x:0,0,player?player.z:0);cloudMat.opacity=.20+w.cloud*.54;cloudMat.color.set(currentWeather==='thunderstorm'?'#58616b':currentWeather==='overcast'||currentWeather==='rain'?'#aeb7ba':currentWeather==='snow'?'#e8ecec':'#f3f4ef');
 precip.visible=!!w.precip;precipMat.color.set(w.precip==='snow'?'#f2f5f7':'#bad6e8');precipMat.size=w.precip==='snow'?.28:.12;
 if(precip.visible){const a=precipGeo.attributes.position.array,fall=w.precip==='snow'?7.5:54,wind=currentWeather==='thunderstorm'?10:currentWeather==='rain'?4:1.2;for(let i=0;i<PRECIP_COUNT;i++){let x=a[i*3],y=a[i*3+1],z=a[i*3+2];y-=fall*realDt;x+=wind*realDt+(w.precip==='snow'?Math.sin(simTime*1.7+i)*realDt*1.8:0);if(y<.2||Math.abs(x)>55){x=rand(-48,48);y=rand(42,68);z=rand(-48,48);}a[i*3]=x;a[i*3+1]=y;a[i*3+2]=z;}precipGeo.attributes.position.needsUpdate=true;precip.position.set(player?player.x:0,0,player?player.z:0);}
 if(currentWeather==='thunderstorm'&&state==='playing'&&vehicles.length&&Math.random()<realDt/210){const candidates=vehicles.filter(v=>!v.disabled),target=choice(candidates);if(target){const dmg=rand(28,62);damage(target,dmg,null);const pts=lightningGeo.attributes.position.array;for(let i=0;i<9;i++){const t=i/8;pts[i*3]=target.x+rand(-2.4,2.4)*(1-t);pts[i*3+1]=110*(1-t)+1.4*t;pts[i*3+2]=target.z+rand(-2.4,2.4)*(1-t);}lightningGeo.attributes.position.needsUpdate=true;lightningBolt.visible=true;lightningBolt.material.opacity=1;lightningTime=.22;flash=Math.max(flash,.95);if(target===player)notify('LIGHTNING STRIKE','Electrical surge damaged the vehicle.',5);}}
 if(lightningTime>0){lightningTime=Math.max(0,lightningTime-realDt);lightningBolt.material.opacity=clamp(lightningTime/.22,0,1);if(lightningTime<=0)lightningBolt.visible=false;}
}
function updateStreetLights(horizon,dt=0){const night=clamp((.34-horizon)/.34,0,1);streetLampMat.emissiveIntensity=night*5.2;streetLampMat.color.set(night>.1?'#fff3c2':'#c6c0a8');if(!player){for(const l of roadLightPool)l.intensity=0;return;}streetLightTick+=dt;if(streetLightTick>=.20||dt===0){streetLightTick=0;const want=roadLightPool.length,bestD=new Array(want).fill(Infinity),bestP=new Array(want).fill(null);for(let k=0;k<streetLightPositions.length;k++){const sp=streetLightPositions[k],dx=sp.x-player.x,dz=sp.z-player.z,d=dx*dx+dz*dz;for(let m=0;m<want;m++)if(d<bestD[m]){for(let q=want-1;q>m;q--){bestD[q]=bestD[q-1];bestP[q]=bestP[q-1];}bestD[m]=d;bestP[m]=sp;break;}}for(let i=0;i<want;i++){const l=roadLightPool[i],e=bestP[i];if(e)l.position.set(e.x,5.75,e.z);} }for(const l of roadLightPool)l.intensity=night*1.15;}
const _dnDay=new THREE.Color(),_dnDusk=new THREE.Color(),_dnNight=new THREE.Color(),_dnSky=new THREE.Color();let _dnClock='';function updateDayNight(realDt,force=false){
 if(state==='playing'&&!force)worldClockHours=(worldClockHours+realDt/60)%24;
 const solar=(worldClockHours-6)/24*TAU,sunHeight=Math.sin(solar),horizon=clamp((sunHeight+.12)/.42,0,1);
 const w=weatherSpec();_dnDay.set(w.daySky);_dnDusk.set(w.duskSky);_dnNight.set(w.nightSky);const daySky=_dnDay,duskSky=_dnDusk,nightSky=_dnNight,sky=_dnSky;
 // Only the sky background changes colour. Do not grade/tint the whole rendered world.
 if(horizon>.26)sky.copy(duskSky).lerp(daySky,clamp((horizon-.26)/.74,0,1));else sky.copy(nightSky).lerp(duskSky,clamp(horizon/.26,0,1));
 scene.background.copy(sky);
 // Fog exists for depth/visibility only. Normal weather pushes it far away; dense fog/rain/snow pull it in.
 scene.fog.color.set(w.fog);scene.fog.near=w.fogNear;scene.fog.far=w.fogFar;
 // Preserve original material colour response: fixed exposure and fixed light chroma, only intensity follows day/night.
 renderer.toneMappingExposure=1.18;hemi.color.set('#e7fff1');hemi.groundColor.set('#66817c');hemi.intensity=.24+2.26*horizon;
 sun.color.set('#fff0cf');sun.intensity=3.3*horizon;moon.color.set('#ffffff');moon.intensity=.32*(1-horizon);
 const px=player?player.x:0,pz=player?player.z:0,az=solar*.72,orbit=150;
 const sx=Math.cos(az)*Math.cos(solar),sz=Math.sin(az)*Math.cos(solar),sy=sunHeight;
 sun.position.set(px+sx*95,Math.max(6,sy*95),pz+sz*95);sun.target.position.set(px,0,pz);
 moon.position.set(px-sx*80,Math.max(8,-sy*72),pz-sz*80);moon.target.position.set(px,0,pz);
 // Keep discs above the urban skyline while they are active so they are actually readable from street level.
 const sunY=Math.max(13,sy*orbit),moonY=Math.max(15,-sy*orbit);
 sunOrb.position.set(px+sx*orbit,sunY,pz+sz*orbit);moonOrb.position.set(px-sx*orbit,moonY,pz-sz*orbit);
 sunOrb.visible=sunHeight>-.055;moonOrb.visible=sunHeight<.055;
 updateStreetLights(horizon,realDt);const phase=horizon>.45?'DAY':horizon>.08?'TWILIGHT':'NIGHT';{const _ct=formatWorldClock()+' · '+phase;if(_ct!==_dnClock){_dnClock=_ct;if($('worldClock'))$('worldClock').textContent=_ct;}}
}
function fuelEfficiencyMultiplier(v,speedKph,throttle,turboActive){
 const opt=v.s.fuel.optimalKph,ratio=opt>0?speedKph/opt:1;
 // Broad efficient band around the vehicle-specific ECON speed. Going slightly slower is not punished much;
 // sustained high speed and wide-open throttle are what meaningfully increase fuel burn.
 const lowPenalty=ratio<1?Math.pow(1-ratio,2)*.12:0;
 const highPenalty=ratio>1?Math.pow(ratio-1,2)*1.15:0;
 const throttlePenalty=Math.max(0,(Math.abs(throttle||0)-.45))*.22;
 let mult=1+lowPenalty+highPenalty+throttlePenalty;
 if(turboActive)mult*=1.8;
 return clamp(mult,.9,3.35);
}
function fuelLeakProfile(v){
 // Heavier vehicles have more protected tanks / thicker structures, so puncture starts later and leaks slower.
 const mass=Math.max(.3,v.s.mass),massNorm=clamp((mass-.34)/(4.65-.34),0,1),protection=Math.sqrt(massNorm);
 let threshold=.31-.205*protection;      // very light ~31%; very heavy ~10.5%
 let rateScale=1.55-.92*protection;      // light cars leak substantially faster
 if(v.type==='motorbike'||v.type==='f1')threshold+=.025;
 if(v.type==='ferrari'||v.type==='roadster'||v.type==='sports')threshold+=.010;
 if(v.type==='truck'||v.type==='bus')threshold-=.010;
 if(v.type==='armored'){threshold-=.028;rateScale*=.55;}
 return {threshold:clamp(threshold,.072,.34),rateScale:clamp(rateScale,.34,1.62)};
}
function updateFuel(v,c,dt,turboActive,speed){
 if(v.disabled)return;
 const forward=v.vx*Math.sin(v.a)+v.vz*Math.cos(v.a);
 // Engine fuel is burned only while the drivetrain is actually being driven.
 // W / positive throttle burns fuel. S only burns fuel once it is acting as reverse throttle;
 // using S to slow a forward-moving car, Shift braking, drifting, and ordinary coasting burn zero engine fuel.
 const driveThrottle=c.t>.05?clamp(c.t,0,1):(c.t<-.05&&forward<.8?clamp(-c.t,0,1):0);
 const speedKph=speed*3.6,travelKm=speed*dt/1000*FUEL_DISTANCE_SCALE;
 let use=0;
 if(driveThrottle>0){
  const eff=fuelEfficiencyMultiplier(v,speedKph,driveThrottle,turboActive);
  use=travelKm/100*v.s.fuel.baseL100*eff*driveThrottle;
  // Fuel used when applying throttle from (almost) stationary, where distance-based consumption is ~0.
  if(speed<.7)use+=v.s.fuel.baseL100/360000*dt*FUEL_DISTANCE_SCALE*.42*driveThrottle*(turboActive?2.15:1);
 }
 // Physical leakage is independent of throttle: a damaged tank can still lose fuel while coasting or stopped.
 const hpRatio=v.hp/v.s.hp,leak=fuelLeakProfile(v);if(hpRatio<leak.threshold&&v.fuel>0){const severity=clamp((leak.threshold-hpRatio)/leak.threshold,0,1);use+=v.fuelMax*(.00034+.00185*severity)*leak.rateScale*dt;}
 v.lastFuelUse=use;if(v.fuel>0){v.fuel=Math.max(0,v.fuel-use);if(v.fuel===0&&!v.fuelEmpty){v.fuelEmpty=true;v.fuelReserve=v.s.fuel.reserveMeters;if(v===player)notify('FUEL EMPTY','Vapour reserve only — find a station or another ride.',4);}}
 if(v.fuel<=0&&v.fuelReserve>0)v.fuelReserve=Math.max(0,v.fuelReserve-speed*dt);
}
function nearestFuelPump(v=player){let best=null,bestD=Infinity;for(const station of fuelStations)for(const pump of station.pumps){const d=Math.hypot(v.x-pump.x,v.z-pump.z);if(d<bestD){bestD=d;best={station,pump,d};}}return best;}
function fuelStationUpdate(realDt){
 nearFuelStation=player?nearestFuelPump(player):null;refuelActive=false;const prompt=$('fuelPrompt');if(!nearFuelStation||nearFuelStation.d>11||state!=='playing'){prompt.classList.add('hidden');return;}
 const speed=Math.hypot(player.vx,player.vz)*3.6,room=player.fuelMax-player.fuel;prompt.classList.remove('hidden');
 if(room<.05){prompt.firstChild.nodeValue='TANK FULL';prompt.querySelector('small').textContent=Math.round(player.fuelMax)+' L · '+player.s.fuel.baseL100.toFixed(1)+' L/100KM BASE';return;}
 if(speed>6){prompt.firstChild.nodeValue='F · REFUEL';prompt.querySelector('small').textContent='SLOW BELOW 6 KM/H BESIDE A PUMP';return;}
 prompt.firstChild.nodeValue='F · HOLD TO REFUEL';prompt.querySelector('small').textContent='PUMP '+Math.ceil(room)+' L · STOPPED VEHICLES ONLY';
 if(keys.KeyF){refuelActive=true;const rate=.72+Math.min(.58,player.fuelMax*.0038);player.fuel=Math.min(player.fuelMax,player.fuel+rate*realDt);player.fuelEmpty=false;player.fuelReserve=player.s.fuel.reserveMeters;if(player.fuel>=player.fuelMax-.02){player.fuel=player.fuelMax;notify('TANK FULL',Math.round(player.fuelMax)+' L · ECON '+player.s.fuel.optimalKph+' KM/H',2);}}
}

function pause(){if(state==='playing'){state='paused';clearKeys();$('pause').classList.remove('hidden');audio.update(0,0,0,false);}}
function resume(){if(state==='paused'){state='playing';clearKeys();$('pause').classList.add('hidden');audio.start();}}
function input(){return {t:(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),s:(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0),b:!!keys.Space,q:!!(keys.ShiftLeft||keys.ShiftRight)};}
 window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyC','KeyE','KeyF','KeyV'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){if(!$('historyDialog').classList.contains('hidden')){$('historyDialog').classList.add('hidden');return;}state==='paused'?resume():pause();return;}if(e.code==='KeyH'){if(state==='title'||state==='over'){$('historyDialog').classList.contains('hidden')?($('historyDialog').classList.remove('hidden'),renderHistory()):$('historyDialog').classList.add('hidden');}return;}if(e.code==='KeyM'){toggleMute();return;}if(e.code==='KeyV'){setCameraMode();return;}if(e.code==='KeyC'){activateTurbo();return;}keys[e.code]=true;});
window.addEventListener('keyup',e=>{delete keys[e.code];if(e.code==='KeyE')swapHeldLatch=false;});window.addEventListener('blur',()=>{clearKeys();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearKeys();pause();}});
function toggleMute(){muted=!muted;audio.setMuted(muted);$('mute').textContent=muted?'SOUND OFF · M':'SOUND ON · M';$('mute').setAttribute('aria-pressed',String(muted));}
function setCameraMode(mode=cameraMode==='cockpit'?'chase':'cockpit'){
 cameraMode=mode==='chase'?'chase':'cockpit';
 const chase=cameraMode==='chase';
 cockpit.visible=!chase;cockpitInterior.visible=!chase;cockpitExterior.visible=!chase;motoCockpit.visible=false;
 camera.fov=chase?72:74;camera.updateProjectionMatrix();
 $('viewMode').textContent=(chase?'CHASE':'COCKPIT')+' · V';
}
 $('mute').onclick=toggleMute;$('viewMode').onclick=()=>setCameraMode();$('pauseBtn').onclick=pause;$('resume').onclick=resume;$('start').onclick=()=>resetRun();$('again').onclick=()=>resetRun();$('change').onclick=()=>resetRun(true);$('historyBtn').onclick=()=>{$('title').classList.remove('hidden');renderHistory();$('historyDialog').classList.remove('hidden');};$('resultsHistory').onclick=()=>{renderHistory();$('historyDialog').classList.remove('hidden');};$('closeHistory').onclick=()=>{$('historyDialog').classList.add('hidden');};
document.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>{selected=b.dataset.car;document.querySelectorAll('[data-car]').forEach(q=>q.setAttribute('aria-pressed',String(q===b)));resetRun(true);});

function clearPath(ax,az,bx,bz,pad=1.3){const dx=bx-ax,dz=bz-az,minX=Math.min(ax,bx)-pad,maxX=Math.max(ax,bx)+pad,minZ=Math.min(az,bz)-pad,maxZ=Math.max(az,bz)+pad,candidates=worldSolidsInAABB(minX,maxX,minZ,maxZ);for(const rb of blocks)for(const b of rb.solids)candidates.push(b);for(const b of candidates){if(maxX<b.x-b.w-pad||minX>b.x+b.w+pad||maxZ<b.z-b.d-pad||minZ>b.z+b.d+pad)continue;let lo=0,hi=1;for(const [p,d,min,max] of [[ax,dx,b.x-b.w-pad,b.x+b.w+pad],[az,dz,b.z-b.d-pad,b.z+b.d+pad]]){if(Math.abs(d)<1e-7){if(p<min||p>max){lo=2;break;}}else{let t1=(min-p)/d,t2=(max-p)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);}}if(lo<=hi)return false;}return true;}
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
 if(!v.route)return {t:0,s:0,b:false};let target=v.route[v.wp];if(Math.hypot(v.x-target.x,v.z-target.z)<4.6){v.wp=(v.wp+1)%v.route.length;target=v.route[v.wp];}
 let speed=v.desired;const junctionDist=Math.hypot(target.x-v.x,target.z-v.z),ownSpeed=Math.hypot(v.vx,v.vz);
 // Approach corners progressively instead of braking at the last metre.
 if(junctionDist<24)speed*=clamp(.42+junctionDist/42,.48,.92);
 // Intersection priority: only one nearby stream commits when paths conflict.
 if(junctionDist<14){for(const o of vehicles){if(o===v||o.role!=='traffic'||o.disabled||!o.route)continue;const od=Math.hypot(o.x-target.x,o.z-target.z);if(od<10.5){const relHeading=Math.abs(Math.sin(o.a-v.a)),priority=od<junctionDist-1.3||Math.abs(od-junctionDist)<1.3&&o.id<v.id;if(relHeading>.35&&priority){speed=0;break;}}}}
 const sin=Math.sin(v.a),cos=Math.cos(v.a);let nearestAhead=Infinity,aheadSpeed=0;
 for(const o of vehicles){if(o===v||o.disabled)continue;const dx=o.x-v.x,dz=o.z-v.z,along=dx*sin+dz*cos,across=dx*cos-dz*sin;if(along>0&&Math.abs(across)<2.45&&along<nearestAhead){nearestAhead=along;aheadSpeed=Math.hypot(o.vx,o.vz);}}
 if(nearestAhead<Infinity){const safeGap=6.4+ownSpeed*.82;if(nearestAhead<safeGap)speed=Math.min(speed,Math.max(0,aheadSpeed-(safeGap-nearestAhead)*1.35));if(nearestAhead<5.4)speed=0;}
 const c=driveTo(v,target.x,target.z,speed);if(speed<.6&&ownSpeed>2.5)c.t=-.22; // engine braking, not reverse panic
 if(ownSpeed<.55)v.stuck+=dt;else v.stuck=Math.max(0,v.stuck-dt*1.7);if(v.stuck>4.5){const close=vehicles.some(o=>o!==v&&!o.disabled&&dist(o,v)<7);if(!close){c.t=-.38;c.s=v.id%2?.22:-.22;}if(v.stuck>5.3){v.wp=(v.wp+1)%v.route.length;v.stuck=0;}}return c;
}
function integrate(v,c,dt){
 v.hitCD=Math.max(0,v.hitCD-dt);v.swapLock=Math.max(0,v.swapLock-dt);v.credit=Math.max(0,v.credit-dt);v.input=c;
 const sx=Math.sin(v.a),cz=Math.cos(v.a);let f=v.vx*sx+v.vz*cz,l=v.vx*cz-v.vz*sx;
  const turboActive=v===player&&turboTime>0&&state==='playing';
  if(!v.disabled){const reserveRatio=v.fuel>0?1:clamp(v.fuelReserve/Math.max(1,v.s.fuel.reserveMeters),0,1),fuelPower=v.fuel>0?1:(v.fuelReserve>0?.28+.42*reserveRatio:0);let force=c.t*v.s.acc*(turboActive?1.65:1)*fuelPower;if(c.t<0&&f>1)force=c.t*37;f+=force*dt;if(c.q){const brakeStep=58*dt;if(f>0)f=Math.max(0,f-brakeStep);else if(f<0)f=Math.min(0,f+brakeStep);}f*=Math.exp(-(c.b?1.45:(c.q ? .72 : .21))*dt);const turboTopBonus=Number.isFinite(v.s.boost)?v.s.boost:9,wthr=weatherSpec();let topSpeed=(v.s.max+(turboActive?Math.max(3,turboTopBonus):0))*wthr.speed;if(v.fuel<=0)topSpeed=Math.min(topSpeed,v.fuelReserve>0?4+8*reserveRatio:Math.max(1,Math.abs(f)));f=clamp(f,-10,topSpeed);const slideGrip=(c.b?(v.type==='motorbike'?1.05:.72):v.s.grip)*wthr.grip;l*=Math.exp(-slideGrip*dt);const steerTarget=c.s*clamp(Math.abs(f)/Math.max(v.s.max*.35,1),0,1);v.steer+=(steerTarget-v.steer)*(1-Math.exp(-dt*(c.b?16:c.q?13:11)));const speedFactor=clamp(Math.abs(f)/Math.max(v.s.max*.28,1),0,1),driftYaw=(c.b?(v.type==='motorbike'?1.28:1.62):1)*wthr.slip;v.a=wrap(v.a+v.steer*v.s.turn*speedFactor*Math.sign(f||1)*driftYaw*dt);}else{f*=Math.exp(-1.35*dt);l*=Math.exp(-1.35*dt);v.steer*=Math.exp(-dt*12);v.deadTime+=dt;}
 const s2=Math.sin(v.a),c2=Math.cos(v.a);v.vx=s2*f+c2*l;v.vz=c2*f-s2*l;const fuelSpeed=Math.hypot(v.vx,v.vz);updateFuel(v,c,dt,turboActive,fuelSpeed);const driftSpeed=fuelSpeed,localF=v.vx*s2+v.vz*c2,localL=v.vx*c2-v.vz*s2,slip=driftSpeed>3?Math.atan2(localL,Math.abs(localF)+.01):0,slipStrength=clamp((Math.abs(slip)-.045)/.46,0,1)*clamp((driftSpeed-7)/22,0,1),handbrakeKick=c.b&&Math.abs(c.s)>.12?clamp((driftSpeed-8)/18,0,1)*.72:0,targetDrift=Math.max(slipStrength,handbrakeKick);v.drift=THREE.MathUtils.lerp(v.drift||0,targetDrift,1-Math.exp(-dt*(targetDrift>v.drift?9:5)));v.driftSlip=slip;v.x+=v.vx*dt;v.z+=v.vz*dt;
 for(const axis of ['x','z']){if(Math.abs(v[axis])>WORLD_EDGE){v[axis]=clamp(v[axis],-WORLD_EDGE,WORLD_EDGE);const vel=axis==='x'?'vx':'vz';if(Math.abs(v[vel])>6)damage(v,collisionDamageFromSpeed(Math.abs(v[vel]),v.s.mass,1,true),null);v[vel]*=-.35;}}
 if(v===player&&state==='playing'){stats.distance+=Math.hypot(v.vx,v.vz)*dt;v.history.push({t:c.t,s:c.s,b:c.b,q:!!c.q});if(v.history.length>20)v.history.shift();}
}
function circles(v){const s=Math.sin(v.a)*v.s.l*.28,c=Math.cos(v.a)*v.s.l*.28,p=v.collisionPoints;for(let i=0;i<3;i++){p[i].x=v.x+(i-1)*s;p[i].z=v.z+(i-1)*c;}return p;}
function collisionDamageFromSpeed(impact,ownMass=1,otherMass=1,wall=false){const effective=Math.max(0,impact-(wall?3.1:2.6));if(effective<=0)return 0;const speedTerm=Math.pow(effective,1.34),massTerm=wall?Math.pow(Math.max(.35,ownMass),.38):Math.pow(Math.max(.35,otherMass),.72)/Math.pow(Math.max(.35,ownMass),.18);return speedTerm*(wall?.46:.54)*massTerm;}
function damage(v,amount,source){if(v.disabled||amount<=0)return;v.hp=Math.max(0,v.hp-amount);if(v===player){shake=Math.min(.9,shake+amount*.012);flash=Math.max(flash,.08);}if(v.hp<=0)disable(v,source);}
function award(points,text,depth=1){if(state!=='playing')return;comboTime=5;combo=Math.min(8,combo+1);stats.chain=Math.max(stats.chain,depth);score+=Math.round(points*(1+Math.min(combo-1,7)*.2));if(text)notify(text,`+${Math.round(points*(1+Math.min(combo-1,7)*.2))} / CHAIN ×${Math.max(depth,1)}`,depth>1?3:1);}
function disable(v,source){if(v.disabled)return;v.disabled=true;v.hp=0;burst(v.x,v.z,'#ffe399',32,10,1);burst(v.x,v.z,'#ff947b',18,7,.8);audio.effect('wreck');wave(v);
 const credited=v.credit>0||source&&(source===player||source.credit>0);if(v!==player&&credited&&state==='playing'){stats.wrecks++;heat+=3;chargeTurbo(8);award(300,v.depth>1?'CHAIN REACTION!':'VEHICLE WRECKED',Math.max(1,v.depth));}
 if(v===player){endRun('VEHICLE TOTALLED');return;}
 for(const o of vehicles){if(o===v||o.disabled)continue;const d=dist(v,o);if(d>0.1&&d<7){const power=(1-d/7)*10;o.vx+=(o.x-v.x)/d*power;o.vz+=(o.z-v.z)/d*power;if(credited&&o!==player&&o.credit<=0){o.credit=5;o.depth=Math.min(8,v.depth+1);}damage(o,power*1.35,v);}}
}
const WORLD_GRID_SIZE=40,worldSolidGrid=new Map();let worldSolidGridReady=false,worldGridStamp=0;
function gridKey(ix,iz){return ix+','+iz;}
function buildWorldSolidGrid(){
 if(worldSolidGridReady)return;worldSolidGridReady=true;
 for(const b of solids){const x0=Math.floor((b.x-b.w)/WORLD_GRID_SIZE),x1=Math.floor((b.x+b.w)/WORLD_GRID_SIZE),z0=Math.floor((b.z-b.d)/WORLD_GRID_SIZE),z1=Math.floor((b.z+b.d)/WORLD_GRID_SIZE);for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const k=gridKey(ix,iz);let a=worldSolidGrid.get(k);if(!a)worldSolidGrid.set(k,a=[]);a.push(b);}}
}
function nearbyWorldSolids(x,z,r=9){buildWorldSolidGrid();const out=[],seen=new Set(),x0=Math.floor((x-r)/WORLD_GRID_SIZE),x1=Math.floor((x+r)/WORLD_GRID_SIZE),z0=Math.floor((z-r)/WORLD_GRID_SIZE),z1=Math.floor((z+r)/WORLD_GRID_SIZE);for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const a=worldSolidGrid.get(gridKey(ix,iz));if(!a)continue;for(const b of a)if(!seen.has(b)){seen.add(b);out.push(b);}}return out;}
function worldSolidsInAABB(minX,maxX,minZ,maxZ){buildWorldSolidGrid();const out=[],seen=new Set(),x0=Math.floor(minX/WORLD_GRID_SIZE),x1=Math.floor(maxX/WORLD_GRID_SIZE),z0=Math.floor(minZ/WORLD_GRID_SIZE),z1=Math.floor(maxZ/WORLD_GRID_SIZE);for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const a=worldSolidGrid.get(gridKey(ix,iz));if(!a)continue;for(const b of a)if(!seen.has(b)){seen.add(b);out.push(b);}}return out;}
function collideWorld(v){
 const r=v.s.w*.48,reach=v.s.l+3,pts=circles(v),mark=++worldGridStamp;
 buildWorldSolidGrid();
 const x0=Math.floor((v.x-reach)/WORLD_GRID_SIZE),x1=Math.floor((v.x+reach)/WORLD_GRID_SIZE),z0=Math.floor((v.z-reach)/WORLD_GRID_SIZE),z1=Math.floor((v.z+reach)/WORLD_GRID_SIZE);
 for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const cell=worldSolidGrid.get(gridKey(ix,iz));if(!cell)continue;for(const b of cell){if(b._gridStamp===mark)continue;b._gridStamp=mark;if(Math.abs(v.x-b.x)>b.w+v.s.l||Math.abs(v.z-b.z)>b.d+v.s.l)continue;for(const p of pts){const qx=clamp(p.x,b.x-b.w,b.x+b.w),qz=clamp(p.z,b.z-b.d,b.z+b.d);let dx=p.x-qx,dz=p.z-qz,d=Math.hypot(dx,dz),pen=r-d;if(pen<=0)continue;if(d<1e-6){const px=b.w+r-Math.abs(p.x-b.x),pz=b.d+r-Math.abs(p.z-b.z);if(px<pz){dx=p.x>=b.x?1:-1;dz=0;pen=px;}else{dx=0;dz=p.z>=b.z?1:-1;pen=pz;}d=1;}const nx=dx/d,nz=dz/d;v.x+=nx*pen;v.z+=nz*pen;const impact=-(v.vx*nx+v.vz*nz);if(impact>0){v.vx+=nx*impact*1.3;v.vz+=nz*impact*1.3;if(impact>4&&v.hitCD<=0){damage(v,collisionDamageFromSpeed(impact,v.s.mass,1,true),null);v.hitCD=.28;if(dist(v,player)<45){burst(p.x,p.z,'#f5dc9d',8,4);audio.effect('hit');}}}}}}
 // Roadblocks remain dynamic and very few; checking them directly is cheaper than rebuilding the static index.
 for(const rb of blocks)for(const b of rb.solids){if(Math.abs(v.x-b.x)>b.w+v.s.l||Math.abs(v.z-b.z)>b.d+v.s.l)continue;for(const p of pts){const qx=clamp(p.x,b.x-b.w,b.x+b.w),qz=clamp(p.z,b.z-b.d,b.z+b.d);let dx=p.x-qx,dz=p.z-qz,d=Math.hypot(dx,dz),pen=r-d;if(pen<=0)continue;if(d<1e-6){dx=1;dz=0;d=1;}const nx=dx/d,nz=dz/d;v.x+=nx*pen;v.z+=nz*pen;const impact=-(v.vx*nx+v.vz*nz);if(impact>0){v.vx+=nx*impact*1.3;v.vz+=nz*impact*1.3;if(impact>4&&v.hitCD<=0){damage(v,collisionDamageFromSpeed(impact,v.s.mass,1,true),null);v.hitCD=.28;}}}}
}
function collideCars(a,b){if(Math.abs(a.x-b.x)>(a.s.l+b.s.l)*.6||Math.abs(a.z-b.z)>(a.s.l+b.s.l)*.6)return;let deepest=null;const r=(a.s.w+b.s.w)*.49;
 const ac=circles(a),bc=circles(b);for(const p of ac)for(const q of bc){const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);if(d<r&&(!deepest||r-d>deepest.pen))deepest={nx:d>1e-6?dx/d:1,nz:d>1e-6?dz/d:0,pen:r-d};}
 if(!deepest)return;const {nx,nz,pen}=deepest,ia=1/a.s.mass,ib=1/b.s.mass,sum=ia+ib;a.x-=nx*pen*ia/sum*.8;a.z-=nz*pen*ia/sum*.8;b.x+=nx*pen*ib/sum*.8;b.z+=nz*pen*ib/sum*.8;
 const impact=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;if(impact<=0)return;const impulse=impact*1.36/sum;a.vx-=nx*impulse*ia;a.vz-=nz*impulse*ia;b.vx+=nx*impulse*ib;b.vz+=nz*impulse*ib;
 if(impact>4&&(a.hitCD<=0||b.hitCD<=0)){
  const ca=a===player||a.credit>0,cb=b===player||b.credit>0;
  if(ca&&b!==player&&b.credit<=0){b.credit=5;b.depth=Math.min(8,a.depth+1);}if(cb&&a!==player&&a.credit<=0){a.credit=5;a.depth=Math.min(8,b.depth+1);}
  if(a.hitCD<=0)damage(a,collisionDamageFromSpeed(impact,a.s.mass,b.s.mass,false),b);if(b.hitCD<=0)damage(b,collisionDamageFromSpeed(impact,b.s.mass,a.s.mass,false),a);a.hitCD=b.hitCD=.3;
  if(dist(a,player)<45){burst((a.x+b.x)/2,(a.z+b.z)/2,'#ffe5a7',14,Math.min(10,impact));audio.effect('hit');}
   if(ca||cb){heat+=.6;const echo=a.role==='echo'||b.role==='echo'||((ca||cb)&&a!==player&&b!==player);if(echo)chargeTurbo(8);award(echo?160:45,echo?'MOMENTUM ECHO HIT':null,Math.max(a.depth,b.depth,1));}
 }
}
const _osV=new THREE.Vector3();function onScreen(x,z,margin=1.18){const p=_osV.set(x,1,z).project(camera);return p.z>=-1&&p.z<=1&&Math.abs(p.x)<margin&&Math.abs(p.y)<margin&&clearPath(camera.position.x,camera.position.z,x,z,0);}
function spawnPolice(){
 const policeCount=vehicles.filter(v=>(v.role==='cop'||v.role==='block')&&!v.disabled).length;
 const cap=[0,4,6,9,12,15][wanted]||4;
 if(policeCount>=cap)return;
 // Police have their own headroom; dense civilian traffic must not silently block pursuit spawns.
 if(vehicles.length>=108){const expendable=vehicles.filter(v=>v.role==='traffic'&&v!==player&&dist(v,player)>170&&!onScreen(v.x,v.z,1.06)).sort((a,b)=>dist(b,player)-dist(a,player))[0];if(expendable)removeVehicle(expendable);else return;}
 const spawnCount=wanted>=4&&policeCount<cap-2?2:1;
 for(let n=0;n<spawnCount;n++){
  const candidates=[];
  for(const r of roadLines)for(let p=WORLD_MIN;p<=WORLD_MAX;p+=SECTOR){
   for(const point of [{x:r+4,z:p},{x:p,z:r-4},{x:r-4,z:p},{x:p,z:r+4}]){
    const d=dist(point,player);if(d>52&&d<190)candidates.push(point);
   }
  }
  if(!candidates.length)break;
  candidates.sort((a,b)=>Math.abs(dist(a,player)-(86+wanted*10))-Math.abs(dist(b,player)-(86+wanted*10)));
  const short=candidates.slice(0,40).filter(point=>!onScreen(point.x,point.z,1.08)&&!vehicles.some(v=>dist(v,point)<8.5));if(!short.length)break;
  const p=short[Math.floor(Math.random()*Math.min(short.length,18))],type=wanted>=3&&Math.random()<(.28+wanted*.06)?'suv':'cop';
  const v=createVehicle(type,p.x,p.z,Math.atan2(player.x-p.x,player.z-p.z),'cop');const launch=19+wanted*1.7;v.vx=Math.sin(v.a)*launch;v.vz=Math.cos(v.a)*launch;v.desired=Math.min(v.s.max,22+wanted*2.2);v.nav=0;
 }
}
function spawnBlock(){if(blocks.length>=2||vehicles.length>104)return;const sx=Math.sin(player.a),cz=Math.cos(player.a);const options=sites.filter(s=>{const dx=s.x-player.x,dz=s.z-player.z,d=Math.hypot(dx,dz);return d>62&&d<145&&dx*sx+dz*cz>25&&!onScreen(s.x,s.z,1.28)&&!blocks.some(b=>dist(b,s)<45)&&!vehicles.some(v=>dist(v,s)<12);}).sort((a,b)=>dist(a,player)-dist(b,player));if(!options.length)return;
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
 const valid=validTarget(swapTarget,true);if(keys.KeyE&&!swapHeldLatch&&swapCooldown===0&&valid){swapProgress=Math.min(1,swapProgress+realDt/.85);if(swapProgress>=1)transfer();}else{swapProgress=Math.max(0,swapProgress-realDt*1.8);if(!valid&&swapProgress===0)swapTarget=null;}
}
function transfer(){const old=player,target=swapTarget;if(!validTarget(target,true))return;const hist=old.history.length?old.history:[old.input],n=hist.length;old.echoInput={t:hist.reduce((s,i)=>s+i.t,0)/n,s:hist.reduce((s,i)=>s+i.s,0)/n,b:hist.filter(i=>i.b).length>n/2,q:hist.filter(i=>i.q).length>n/2};old.echo=2.6;old.role='echo';old.credit=7;old.depth=0;old.swapLock=4;old.history=[];
 player=target;player.role='player';player.credit=0;player.depth=0;player.hitCD=.5;player.swapLock=0;player.history=[];cameraYaw=player.a;arrest=Math.max(0,arrest-1.4);swapTarget=null;swapProgress=0;swapCooldown=1.6;swapHeldLatch=true;turboTime=0;stats.swaps++;heat+=2;chargeTurbo(20);award(120);wave(old);wave(player);burst(old.x,old.z,'#73fff0',24,8);burst(player.x,player.z,'#dfff8b',24,8);flash=.62;callout=1;$('callout').textContent='HOTSWAP';shake=.24;audio.effect('swap');notify('MOMENTUM ECHO','Your old ride has 2.6 seconds of unfinished business.',3);}
function endRun(reason){if(state!=='playing')return;state='ending';gameOverTimer=0;clearKeys();swapTarget=null;swapProgress=0;$('resultReason').textContent=reason;notify(reason,'THE CITY ALWAYS GETS THE LAST WORD.',5);audio.effect('wreck');}
 function showResults(){if(state==='over')return;state='over';if(!runPersisted)persistRun();$('finalScore').textContent=Math.floor(score).toLocaleString();$('bestScore').textContent='PERSONAL BEST / '+best.toLocaleString();$('coinPayout').textContent='RUN PAYOUT / +'+lastCoinPayout.toLocaleString()+' COINS · WALLET '+coins.toLocaleString();$('saveStatus').textContent=storageWarning||'LOCAL ARCHIVE + WALLET UPDATED';$('statTime').textContent=Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0');$('statSwaps').textContent=stats.swaps;$('statWrecks').textContent=stats.wrecks;$('statChain').textContent='×'+stats.chain;$('statDistance').textContent=Math.round(stats.distance).toLocaleString();$('statWanted').textContent=peakWanted+' / 5';$('results').classList.remove('hidden');$('hud').classList.add('hidden');$('arrest').classList.add('hidden');$('targetLabel').classList.add('hidden');$('fuelPrompt').classList.add('hidden');$('toast').classList.remove('show');}

let simCull=0;
function simulation(dt){simTime+=dt;particleTick+=dt;
 for(const v of vehicles){v.px=v.x;v.pz=v.z;v.pa=v.a;}
 for(const v of vehicles){let c;if(v===player){c=state==='playing'?input():state==='title'?ai(v,dt):{t:0,s:0,b:false};}else c=ai(v,dt);integrate(v,c,dt);collideWorld(v);}
 const VEHICLE_GRID=14,vg=new Map();for(const v of vehicles){const ix=Math.floor(v.x/VEHICLE_GRID),iz=Math.floor(v.z/VEHICLE_GRID),k=(ix+128)*512+(iz+128);let a=vg.get(k);if(!a)vg.set(k,a=[]);a.push(v);v._gix=ix;v._giz=iz;}
 for(const a of vehicles){for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){const bucket=vg.get((a._gix+ox+128)*512+(a._giz+oz+128));if(!bucket)continue;for(const b of bucket)if(b.id>a.id)collideCars(a,b);}}
 if(particleTick>.052){particleTick=0;for(const v of vehicles){const near=dist(v,player)<72;if(!near)continue;const speed=Math.hypot(v.vx,v.vz),drift=v.drift||0;if(v.disabled||v.hp/v.s.hp<.35)smoke(v);if(v.role==='echo'){smoke(v,'#6cebd7');if(Math.random()<.4)burst(v.x,v.z,'#a4fff1',2,1,.3);}if(drift>.10&&speed>9){skid(v,drift);tyreSmoke(v,drift);}else if(v.input.b&&speed>12&&Math.abs(v.input.s)>.18){skid(v,.18);if(Math.random()<.45)tyreSmoke(v,.20);}}}
  if(state!=='playing')return;
  const playerSpeed=Math.hypot(player.vx,player.vz);if(turboTime>0)turboTime=Math.max(0,turboTime-dt);else if(playerSpeed>15)chargeTurbo(dt*(playerSpeed-15)/20*5.5);
  elapsed+=dt;score+=playerSpeed*dt*.38;comboTime-=dt;if(comboTime<=0)combo=0;
 const next=Math.min(5,1+Math.floor(elapsed/19+heat/22));if(next>wanted){wanted=peakWanted=next;notify(wanted===3?'INTERCEPT UNITS INBOUND':wanted===5?'THE WHOLE CITY WANTS YOU':'PURSUIT ESCALATING',wanted===2?'Patrols are coordinating. Roadblocks authorized.':wanted===3?'Heavy units. Predictive pursuit. Fewer places to hide.':'More units have joined the chase.',4);audio.effect('wanted');spawnTimer=0;}
 spawnTimer-=dt;if(spawnTimer<=0){spawnPolice();const pc=vehicles.filter(v=>(v.role==='cop'||v.role==='block')&&!v.disabled).length,target=[0,4,6,9,12,15][wanted]||4;spawnTimer=pc<Math.ceil(target*.6)?.72:Math.max(1.05,2.75-wanted*.30);}
 blockTimer-=dt;if(wanted>=2&&blockTimer<=0){spawnBlock();blockTimer=blocks.length?20:2;}
  let closest=Infinity;for(const v of vehicles){if(v.disabled)continue;if(v.role==='cop'||v.role==='block')closest=Math.min(closest,dist(v,player));if(v!==player&&v.role==='traffic'){const d=dist(v,player);if(d<4.5&&d>2.7&&playerSpeed>21&&!v.near&&v.hitCD<=0){v.near=true;chargeTurbo(12);award(40,'NEAR MISS');}if(d>12)v.near=false;}}
 arrest=clamp(arrest+(closest<8.5&&Math.hypot(player.vx,player.vz)<4?dt:-dt*1.5),0,3.5);if(arrest>=3.5)endRun('BUSTED / BOXED IN');
 simCull-=dt;if(simCull<=0){simCull=.3;for(const v of [...vehicles]){if(v===player||v===swapTarget||v.role==='echo')continue;const far=dist(v,player)>190;if(far&&!onScreen(v.x,v.z)&&(v.disabled||v.role==='abandoned'||v.role==='traffic'&&dist(v,player)>285||v.role==='cop'&&dist(v,player)>325)){removeVehicle(v);}}
 if(vehicles.filter(v=>v.role==='traffic').length<74){for(let n=0;n<2;n++){const v=spawnTraffic(player);if(v&&onScreen(v.x,v.z,1.05)&&dist(v,player)<75)removeVehicle(v);}}}
 for(let i=blocks.length-1;i>=0;i--){blocks[i].life+=dt;if(blocks[i].life>25&&dist(blocks[i],player)>100){for(const v of blocks[i].cars)if(v.role==='block')removeVehicle(v);scene.remove(blocks[i].g);blocks.splice(i,1);}}
}
function syncVehicle(v,dt){v.g.position.set(THREE.MathUtils.lerp(v.px,v.x,renderAlpha),0,THREE.MathUtils.lerp(v.pz,v.z,renderAlpha));v.g.rotation.y=v.pa+wrap(v.a-v.pa)*renderAlpha;const showPlayer=v===player&&cameraMode==='chase',dPlayer=!player||v===player?0:Math.hypot(v.x-player.x,v.z-player.z);v.g.visible=(v!==player||showPlayer)&&(!player||v===player||dPlayer<215);if(!v.g.visible&&v!==player)return;const proxy=v.role==='traffic'&&dPlayer>88;v.lodProxy.visible=proxy;v.body.visible=!proxy;for(const axle of v.wheels)if(axle.parent===v.g)axle.visible=!proxy;if(proxy)return;const speed=Math.hypot(v.vx,v.vz),drift=v.drift||0,slipSign=Math.sign(v.driftSlip||v.input.s||1),bike=v.type==='motorbike';const steerLean=-v.input.s*Math.min(speed/30,1)*(bike?.25:.045),driftLean=slipSign*drift*(bike?.18:.105),targetRoll=v.disabled?.13:clamp(steerLean+driftLean,bike?-.42:-.16,bike?.42:.16),brakePitch=v.input.q?.045:0,driftPitch=drift*.018;v.body.rotation.z=THREE.MathUtils.lerp(v.body.rotation.z,targetRoll,Math.min(1,dt*(bike?12:9)));v.body.rotation.x=THREE.MathUtils.lerp(v.body.rotation.x,-v.input.t*.028+brakePitch+driftPitch,Math.min(1,dt*9));for(const axle of v.wheels){if(!axle.userData.front)continue;const base=Number.isFinite(axle.userData.baseY)?axle.userData.baseY:0,counter=drift>.16?-Math.sign(v.driftSlip||v.steer)*drift*.22:0;axle.rotation.y=THREE.MathUtils.lerp(axle.rotation.y,base+v.steer*(bike?.34:.42)+counter,Math.min(1,dt*12));}v.body.position.y=v.disabled?-.12:Math.sin(simTime*14+v.id)*Math.min(speed*.0007,.025);if(!v.paint.userData.original)v.paint.userData.original=v.paint.color.clone();
  {const _ps=(v.disabled?'D':(v.hp/v.s.hp<.4?'H':'N'))+(v.role==='echo'&&!v.disabled?'E':'');if(_ps!==v._ps){v._ps=_ps;v.paint.color.set(v.disabled?'#647875':v.paint.userData.original);if(!v.disabled&&v.hp/v.s.hp<.4)v.paint.color.copy(v.paint.userData.original).multiplyScalar(.7);v.paint.emissive.set(v.role==='echo'&&!v.disabled?'#2a8e79':'#000000');}}
 if(v.lights){const active=(v.role==='cop'||v.role==='block')&&!v.disabled;v.lights[0].visible=active&&Math.sin(simTime*19+v.id)>-.1;v.lights[1].visible=active&&!v.lights[0].visible;}
}
function updateParticles(dt){let changed=false;for(let i=0;i<particles.length;i++){const p=particles[i];if(p.life<=0&&!p.drawn)continue;if(p.life>0){p.drawn=true;p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=p.smoke?0:15*dt;if(p.y<.1){p.y=.1;p.vy=Math.abs(p.vy)*.3;}const ratio=clamp(p.life/p.total,0,1);dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.size*(p.smoke?(2-ratio)*ratio:Math.min(1,ratio*3)));dummy.rotation.set(p.spin*p.life,p.life*2,p.life);}else{p.drawn=false;dummy.position.set(0,-100,0);dummy.scale.setScalar(0);}dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);changed=true;}if(changed)particleMesh.instanceMatrix.needsUpdate=true;
 for(const w of waves){if(w.life>0){w.life-=dt*1.5;w.m.visible=w.life>0;w.m.scale.setScalar(1+(1-w.life)*5);w.m.material.opacity=Math.max(0,w.life*.7);}}
}
const mapCtx=$('map').getContext('2d');
function drawMap(){
 const c=mapCtx,w=264,scale=.50;c.clearRect(0,0,w,w);c.fillStyle='#122f39';c.fillRect(0,0,w,w);c.save();c.translate(w/2,w/2);c.scale(scale,scale);c.translate(-player.x,-player.z);
 c.strokeStyle='#48636a';c.lineWidth=10;c.beginPath();for(const r of roadLines){c.moveTo(WORLD_MIN-20,r);c.lineTo(WORLD_MAX+20,r);c.moveTo(r,WORLD_MIN-20);c.lineTo(r,WORLD_MAX+20);}c.stroke();
 for(const b of blocks){c.fillStyle='#ffc777';c.fillRect(b.x-5,b.z-5,10,10);}
 // Fuel stations: high-contrast outlined marker + G, larger than traffic dots.
 c.font='bold 9px monospace';c.textAlign='center';c.textBaseline='middle';for(const station of fuelStations){const d=Math.hypot(station.x-player.x,station.z-player.z),pulse=d<130?1+Math.sin(simTime*5)*.18:1;c.save();c.translate(station.x,station.z);c.scale(pulse,pulse);c.fillStyle='#ffe45d';c.strokeStyle='#10252c';c.lineWidth=2.2;c.beginPath();c.arc(0,0,7.2,0,TAU);c.fill();c.stroke();c.fillStyle='#10252c';c.fillText('G',0,.3);c.restore();}
 // Landmark blocks are smaller neutral symbols so fuel markers remain dominant.
 c.font='bold 7px monospace';for(const lm of landmarkMarkers){c.fillStyle='#dce6d7';c.strokeStyle='#263b41';c.lineWidth=1.4;c.beginPath();c.rect(lm.x-4.6,lm.z-4.6,9.2,9.2);c.fill();c.stroke();c.fillStyle='#263b41';c.fillText(lm.type,lm.x,lm.z+.3);}
 for(const v of vehicles){if(v===player||v.disabled)continue;c.fillStyle=v.role==='cop'||v.role==='block'?'#ff7382':v.role==='echo'?'#70ffe1':'#b1c4ae';c.beginPath();c.arc(v.x,v.z,v.role==='cop'?3.8:2.3,0,TAU);c.fill();}
 c.translate(player.x,player.z);c.rotate(-player.a);c.fillStyle='#e4ff74';c.beginPath();c.moveTo(0,8);c.lineTo(-5,-5);c.lineTo(5,-5);c.closePath();c.fill();c.restore();c.fillStyle='#c9dec9';c.font='14px monospace';c.textAlign='start';c.textBaseline='alphabetic';c.fillText('N',12,22);
}
function hud(dt){$('score').textContent=String(Math.floor(score)).padStart(6,'0');$('combo').textContent=combo>1?'×'+(1+Math.min(combo-1,7)*.2).toFixed(1)+' CHAOS MULTIPLIER':'MAKE AN IMPRESSION.';if(shownWanted!==wanted){shownWanted=wanted;$('stars').innerHTML=Array.from({length:5},(_,i)=>'<span class="'+(i<wanted?'on':'')+'">★</span>').join('');$('pursuitText').textContent=['PATROL UNITS DEPLOYED','ROADBLOCKS AUTHORIZED','INTERCEPT TEAMS ACTIVE','HEAVY UNITS IN PURSUIT','CITYWIDE LOCKDOWN'][wanted-1];}
 $('carName').textContent=player.s.name;const hp=clamp(player.hp/player.s.hp*100,0,100);$('health').style.width=hp+'%';$('health').style.background=hp<30?'var(--red)':'var(--cyan)';$('healthText').textContent=Math.ceil(hp)+'%';$('speed').textContent=String(Math.round(Math.hypot(player.vx,player.vz)*3.6)).padStart(2,'0');const fuelPct=clamp(player.fuel/player.fuelMax*100,0,100);$('fuelText').textContent=player.fuel.toFixed(1)+' / '+Math.round(player.fuelMax)+' L';$('fuelBar').style.width=fuelPct+'%';$('fuelBar').classList.toggle('low',fuelPct<18);const leakProfile=fuelLeakProfile(player),leak=player.hp/player.s.hp<leakProfile.threshold;$('fuelMeta').classList.toggle('leak',leak);$('fuelMeta').textContent=(leak?'LEAKING · ':'')+'ECON '+player.s.fuel.optimalKph+' KM/H · '+player.s.fuel.baseL100.toFixed(1)+' L/100 BASE';$('swapProgress').style.width=swapProgress*100+'%';
 $('swapTitle').textContent=swapCooldown>0?'SIGNAL RECHARGING':swapProgress>0?'TRANSFERRING…':swapTarget?'HOLD TO HOTSWAP':'FIND YOUR NEXT RIDE';$('swapInfo').textContent=swapCooldown>0?'READY IN '+swapCooldown.toFixed(1)+'s':swapTarget?swapTarget.s.name+' / '+Math.round(dist(player,swapTarget))+' M / '+Math.round(swapTarget.hp/swapTarget.s.hp*100)+'% BODY':'GET CLOSE · FACE THE SAME DIRECTION';
 const turboReady=turboCharge>=100&&!turboTime,turboPct=turboTime>0?100:Math.floor(turboCharge);$('turboValue').textContent=turboTime>0?'BOOST '+turboTime.toFixed(1)+'s':turboPct+'%';$('turboProgress').style.width=turboPct+'%';$('turboProgress').classList.toggle('ready',turboReady);$('turboHint').textContent=turboTime>0?'BOOST ACTIVE · CHARGE PAUSED':turboReady?'C TO ACTIVATE':'SPEED · NEAR MISSES · SWAPS';
 $('arrest').classList.toggle('hidden',arrest<.15||state!=='playing');$('arrest').querySelector('i').style.width=arrest/3.5*100+'%';$('damageEdge').style.opacity=state==='playing'?Math.max(0,(.35-hp/100)*1.5)+(arrest/3.5)*.2:0;minimapTick+=dt;if(minimapTick>.12){drawMap();minimapTick=0;}}
function updateCityChunkVisibility(dt,force=false){
 if(!player)return;cityCullTick+=dt;if(!force&&cityCullTick<.15)return;cityCullTick=0;
 const px=player.x,pz=player.z,r2=CITY_RENDER_RADIUS*CITY_RENDER_RADIUS;
 for(const chunk of cityChunks){const dx=chunk.userData.chunkX-px,dz=chunk.userData.chunkZ-pz;chunk.visible=dx*dx+dz*dz<=r2;}
}
function visuals(dt){updateWeather(dt);updateDayNight(dt,dt===0);updateCityChunkVisibility(dt,dt===0);for(const v of vehicles)syncVehicle(v,dt);const running=state==='playing'||state==='ending';
 const speed=Math.hypot(player.vx,player.vz),rawA=player.g.rotation.y,pos=player.g.position;
 const yawDelta=wrap(rawA-cameraYaw),yawResponse=1-Math.exp(-dt*(speed<8?18:12));cameraYaw=wrap(cameraYaw+yawDelta*yawResponse);
 const sx=Math.sin(cameraYaw),cz=Math.cos(cameraYaw),rx=Math.cos(cameraYaw),rz=-Math.sin(cameraYaw),chase=cameraMode==='chase';
 const shakeJitter=clamp(shake,0,.9)*.014*(Math.random()-.5);
 const bikeView=player.type==='motorbike';motoCockpit.visible=!chase&&bikeView;cockpit.visible=!chase&&!bikeView;
 if(chase){
  // Proper trailing camera: far enough back to frame the whole vehicle and enough height
  // to read its roof/body shape without making the car dominate the screen.
  const chaseDistance=clamp(9.8+player.s.l*.55,10.5,13.5),chaseHeight=4.7+player.s.h*.55;
  const lateral=clamp(player.steer,-1,1)*-.38,lookAhead=4.5+Math.min(speed*.08,2.4);
  camera.position.set(pos.x-sx*chaseDistance+rx*lateral,pos.y+chaseHeight+shakeJitter,pos.z-cz*chaseDistance+rz*lateral);
  camera.lookAt(pos.x+sx*lookAhead,pos.y+1.05+player.s.h*.28,pos.z+cz*lookAhead);
  cockpit.visible=false;
 }else{
  const eye=(bikeView?1.48:1.28+player.s.h*.28),forwardOffset=bikeView?.22:.02,sideOffset=bikeView?0:-.38;
  const bob=Math.sin(simTime*(9+speed*.08))*Math.min(speed*.0012,.016);
  camera.position.set(pos.x+sx*forwardOffset+rx*sideOffset,eye+bob+shakeJitter,pos.z+cz*forwardOffset+rz*sideOffset);
  camera.lookAt(camera.position.x+sx*42,eye-(bikeView?.25:.42),camera.position.z+cz*42);
  cockpitInterior.visible=!bikeView;cockpitExterior.visible=!bikeView;
  hood.material.color.copy(player.paint.color);hood.position.z=-2.55;hood.visible=!bikeView&&!['bus','van','truck'].includes(player.type);
  wheel.rotation.z=THREE.MathUtils.lerp(wheel.rotation.z,player.input.s*.54,1-Math.exp(-dt*10));
  if(bikeView){motoCockpitTank.material.color.copy(player.paint.color);motoCockpit.rotation.z=THREE.MathUtils.lerp(motoCockpit.rotation.z,player.input.s*.09,1-Math.exp(-dt*8));}
 }
 camera.updateMatrixWorld(true);
 shadowTick+=dt;if(shadowTick>=1/6){shadowTick=0;sun.shadow.needsUpdate=true;}
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
function force1080pInternal(){renderer.setPixelRatio(1);renderer.setSize(INTERNAL_RENDER_W,INTERNAL_RENDER_H,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();force1080pInternal();}addEventListener('resize',resize);resize();
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('error').classList.remove('hidden');$('errorText').textContent='The graphics context was interrupted. Reconnect to rebuild the city.';});
resetRun(true);window.gameReady=true;$('loading').classList.add('hidden');$('start').disabled=false;$('start').innerHTML='START CHASE <span>↗</span>';
// Uncapped presentation: requestAnimationFrame runs at the display/browser refresh rate (120/144/etc.).
let lastRAF=performance.now();
function frame(now){requestAnimationFrame(frame);const wallDt=Math.max(0,(now-lastRAF)/1000);lastRAF=now;const realDt=Math.min(wallDt,.05);
 if(state==='playing'){swapUpdate(realDt);fuelStationUpdate(realDt);}else $('fuelPrompt')?.classList.add('hidden');
 let scale=1;if(state==='ending'){gameOverTimer+=realDt;scale=.16;if(gameOverTimer>=1.4)showResults();}
 if(state==='playing'||state==='title'||state==='ending'){const total=realDt*scale;accumulator=Math.min(accumulator+total,FIXED_STEP*5);while(accumulator+1e-9>=FIXED_STEP){accumulator=Math.max(0,accumulator-FIXED_STEP);simulation(FIXED_STEP);}renderAlpha=accumulator/FIXED_STEP;updateParticles(total);updateDriftSmoke(total);}
 visuals(realDt);if(state==='playing'||state==='ending'){hudTick+=realDt;if(hudTick>=1/30){hud(hudTick);hudTick=0;}}
 if(state==='playing'){fpsTime+=wallDt;fpsFrames++;if(fpsTime>=1){const fps=Math.round(fpsFrames/fpsTime),w=renderer.domElement.width,h=renderer.domElement.height;fpsLabel.textContent=fps+' FPS · '+w+'×'+h;fpsTime=fpsFrames=0;}}
 const threat=vehicles.reduce((n,v)=>v.role==='cop'&&!v.disabled?Math.max(n,clamp(1-dist(v,player)/80,0,1)):n,0);audio.update(Math.hypot(player.vx,player.vz)/player.s.max,threat,realDt,state==='playing');renderer.render(scene,camera);
}
requestAnimationFrame(frame);
