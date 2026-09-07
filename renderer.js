const iconPaths = {
  home:'<path d="m3 11 9-8 9 8v10h-6v-7H9v7H3z"/>',
  game:'<path d="M7 6h10c3 0 4 3 5 11 .4 4-3 4-6-1H8c-3 5-6 5-6 1C3 9 4 6 7 6Z"/><path d="M7 9v6m-3-3h6m6-2h.1m3 3h.1"/>',
  tools:'<path d="m4 3 5 5-2 2-5-5v5l4 3 4-1 9 9 3-3-9-9 1-4-3-3H6m-3 18 6-6m8-7 4-4"/>',
  productivity:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h4v4H8zm7 0h2m-3 8h3v3h-3M8 15h2m-2 3h2"/>',
  study:'<path d="m2 8 10-5 10 5-10 5zM6 11v6c4 3 8 3 12 0v-6m4-3v9"/>',
  finance:'<path d="M4 4h15v17H4zM19 10h3v5h-8v-5zm-2 2h.1"/>',
  creative:'<path d="M8 16 5 21l-2-3 5-3m0 1c3 2 6-1 9-5s4-8 4-8-5 1-8 4-6 6-5 9Z"/>',
  library:'<path d="M3 6h7l2 3h9v12H3z"/>',
  stats:'<path d="M5 21V12h2v9m4 0V4h2v17m4 0V9h2v12"/>',
  settings:'<path d="m10 2-1 4-3-1-2 3 3 3-1 3-3 1 2 4 4-1 2 3 4-1 1-4 4-1v-4l-3-2V5l-4-1z"/><circle cx="12" cy="12" r="3"/>',
  search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  music:'<path d="M9 18V6l11-3v12M9 9l11-3"/><ellipse cx="6" cy="19" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  volume:'<path d="M3 10h4l5-5v14l-5-5H3zm13-3c3 3 3 7 0 10m3-13c5 5 5 11 0 16"/>',
  play:'<path d="m6 3 15 9-15 9z"/>',
  pause:'<rect x="5" y="3" width="5" height="18" rx="2"/><rect x="14" y="3" width="5" height="18" rx="2"/>',
  cloud:'<path d="M5 20C-1 19 0 11 6 11 4 2 18 0 19 10c7 0 8 10 1 10Z"/>',
  book:'<path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1v16M5 7l4 1m6 0 4-1"/>',
  exercise:'<path d="m8 8 8 8M5 4l-2 2 5 5 2-2zm11 9-2 2 5 5 2-2zM7 2 2 7m20 10-5 5"/>',
  coin:'<circle cx="12" cy="12" r="10"/><path d="M15 7c-8-3-9 5-3 5 6 0 5 8-3 5m3-12v14"/>'
};
Object.assign(iconPaths, {
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
  grid:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>'
});
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.grid}</svg>`; }
function appIcon(name) { return `<img class="app-icon" src="assets/icons/${name}.svg" alt="">`; }
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const nav = ['Home', ...CATEGORIES.slice(1), 'Favorite', 'Library', 'Stats', 'Settings'];
const navIcons = {Home:'home',Games:'game',Tools:'tools',Productivity:'productivity',Study:'study',Finance:'finance',Creative:'creative',Favorite:'star',Library:'library',Stats:'stats',Settings:'settings'};
document.querySelector('#navigation').innerHTML = nav.map((name,i)=>`${i===8 ? '<div class="nav-divider"></div>' : ''}<button class="nav-item ${i===0?'active':''}" data-nav="${name}" aria-label="${name}" ${i===0?'aria-current="page"':''}>${icon(navIcons[name])}<span>${name}</span></button>`).join('');
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let favorites = new Set(), recentIds = [];
try { const saved=JSON.parse(localStorage.getItem('aether-favorites')); if(Array.isArray(saved))favorites=new Set(saved.filter(id=>typeof id==='string')); const recent=JSON.parse(localStorage.getItem('aether-recent')); if(Array.isArray(recent))recentIds=recent.filter(id=>typeof id==='string').slice(0,4); } catch {}
let favoriteOnly=false, category='All', expanded=false, localApps=[], scanning=false;
function card(app,recent=false) {
  const subtitle=recent ? (app.recent ? app.recent.replace('Played','Last played').replace('Opened','Last opened') : 'Recently opened') + ' · ' + ({'2048':'Puzzle',tetris:'Arcade',planner:'Productivity'}[app.id] || app.category) : app.detail;
  return `<article class="app-row ${app.tone}">${recent?'':`<button class="favorite-app" data-favorite="${app.id}" aria-label="Favorite ${escapeHTML(app.name)}" aria-pressed="${favorites.has(app.id)}">${icon('star')}</button>`}${app.cover?`<img class="app-icon" src="${escapeHTML(app.cover)}" alt="">`:appIcon(app.icon)}<div class="app-copy"><strong>${escapeHTML(app.name)}</strong><small>${escapeHTML(subtitle)}</small></div><button class="open-app" data-app="${app.id}" aria-label="Open ${escapeHTML(app.name)}">Open</button><button class="more-app" data-details="${app.id}" aria-label="Details for ${escapeHTML(app.name)}">···</button></article>`;
}
function renderRecent() { const all=[...localApps,...APPS]; const ids=[...new Set([...recentIds,'2048','planner','tetris','pomodoro'])].filter(id=>all.some(app=>app.id===id)).slice(0,4); document.querySelector('#recent').innerHTML=ids.map(id=>card(all.find(app=>app.id===id),true)).join(''); }
function renderExplore() {
  const query=document.querySelector('#search').value.trim().toLowerCase();
  const apps=[...localApps,...APPS].filter(app=>(!favoriteOnly||favorites.has(app.id))&&(category==='All'||app.category===category)&&(!query||`${app.name} ${app.category} ${app.detail}`.toLowerCase().includes(query))&&(favoriteOnly||expanded||query||category!=='All'||app.explore));
  document.querySelector('#explore').innerHTML=apps.map(app=>card(app)).join('');
  document.querySelector('#empty').hidden=apps.length>0;
  document.querySelector('#empty').textContent=favoriteOnly?'No favorites yet. Select a star beside an app to save it here.':'No apps found. Try another search or category.';
  document.querySelector('#filters').innerHTML=CATEGORIES.map(name=>`<button data-category="${name}" class="${category===name?'active':''}" aria-pressed="${category===name}">${name}</button>`).join('');
  document.querySelector('#explore-title').innerHTML=(favoriteOnly?'Favorite':'All Tools &amp; Games')+' <span>›</span>';
}
function selectNav(name) { document.querySelectorAll('[data-nav]').forEach(button=>{const active=button.dataset.nav===name;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}); }
function setCategory(name) { favoriteOnly=false;category=name;selectNav(name==='All'?'Home':name);renderExplore(); }
async function refreshApps() { if(!window.launcher?.listApps||scanning)return;scanning=true;try{const result=await window.launcher.listApps();localApps=result.apps;renderExplore();renderRecent();if(result.errors.length)notify(result.errors.join(' / '));}catch{notify('无法读取 apps 目录。');}finally{scanning=false;} }
window.addEventListener('focus',refreshApps);
const dialog=document.querySelector('#app-dialog');
function details(name,description,image='grid',playable=false) { document.querySelector('#dialog-title').textContent=name;document.querySelector('#dialog-description').textContent=description;document.querySelector('#dialog-icon').innerHTML=appIcon(image);document.querySelector('.connection-status').textContent=playable?'本地离线应用 · 点击 Open 启动':'功能尚未接入 · 预留独立应用入口';dialog.showModal(); }
document.addEventListener('click',async event=>{
  const star=event.target.closest('[data-favorite]');
  if(star){const id=star.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('aether-favorites',JSON.stringify([...favorites]));}catch{notify('无法保存收藏。');}renderExplore();}
  const view=event.target.closest('[data-view]');
  if(view){document.querySelector('#explore').classList.toggle('grid-view',view.dataset.view==='grid');document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button===view)));}
  const more=event.target.closest('[data-details]');
  if(more){const app=[...localApps,...APPS].find(item=>item.id===more.dataset.details);details(app.name,app.detail,app.icon,app.playable);}
  const launch=event.target.closest('[data-app]');
  if(launch){const app=[...localApps,...APPS].find(item=>item.id===launch.dataset.app);if(app.playable){launch.disabled=true;try{const result=await window.launcher.openApp(app.id);if(result.error)notify(result.error);else{recentIds=[app.id,...recentIds.filter(id=>id!==app.id)].slice(0,4);try{localStorage.setItem('aether-recent',JSON.stringify(recentIds));}catch{notify('无法保存最近打开记录。');}renderRecent();}}catch{notify('应用启动失败，请重试。');}finally{launch.disabled=false;}}else details(app.name,app.detail,app.icon);}
  const filter=event.target.closest('[data-category]');if(filter)setCategory(filter.dataset.category);
  const navigation=event.target.closest('[data-nav]');
  if(navigation){const name=navigation.dataset.nav;if(name==='Home'){expanded=false;document.querySelector('#search').value='';setCategory('All');}else if(CATEGORIES.includes(name))setCategory(name);else if(name==='Library'){expanded=true;setCategory('All');selectNav('Library');}else if(name==='Favorite'){category='All';favoriteOnly=true;selectNav(name);renderExplore();}else details(name,name==='Settings'?'个性化设置将在后续接入。':'活动统计将在连接真实应用后显示。');}
  const control=event.target.closest('[data-window]');if(control)window.launcher?.controlWindow(control.dataset.window);
});
document.querySelector('#search').addEventListener('input',renderExplore);
document.querySelector('#close-dialog').onclick=document.querySelector('#dialog-done').onclick=()=>dialog.close();
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
const appearance = document.querySelector('#appearance');
function closeAppearance() { appearance.hidden = true; document.querySelector('#profile').setAttribute('aria-expanded','false'); }
document.querySelector('#profile').onclick=()=>{appearance.hidden=!appearance.hidden;document.querySelector('#profile').setAttribute('aria-expanded',String(!appearance.hidden));};
document.querySelectorAll('[data-theme-choice]').forEach(button=>{
  button.setAttribute('aria-pressed',String(button.dataset.themeChoice === document.documentElement.dataset.theme));
  button.onclick=async()=>{
    const theme=button.dataset.themeChoice;
    document.documentElement.dataset.theme=theme;
    document.querySelectorAll('[data-theme-choice]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    try { localStorage.setItem('aether-theme',theme); } catch { notify('无法保存外观设置。'); }
    try { await window.launcher?.setTheme(theme); } catch { notify('窗口材质切换失败，请重新打开启动台。'); }
    closeAppearance();
  };
});
document.addEventListener('click',event=>{if(!event.target.closest('#appearance,#profile'))closeAppearance();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!appearance.hidden){closeAppearance();document.querySelector('#profile').focus();}});
document.addEventListener('keydown',event=>{if(!dialog.open&&((event.key.toLowerCase()==='k'&&(event.ctrlKey||event.metaKey))||(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)))){event.preventDefault();document.querySelector('#search').focus();}});
let toastTimer;
function notify(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3500);}

const initialTasks = [
  { name: 'Math past paper', time: '14:00 – 16:00', done: true },
  { name: 'Physics notes review', time: '16:30 – 17:30', done: false },
  { name: 'Go for a run', time: '18:00 – 18:30', done: false },
  { name: 'Read 20 pages', time: '21:00 – 21:30', done: false }
];
let tasks = initialTasks.map(task => ({...task}));
try { const saved = JSON.parse(localStorage.getItem('aether-tasks')); if (Array.isArray(saved) && saved.every(task => task && typeof task.name === 'string' && typeof task.time === 'string' && typeof task.done === 'boolean')) tasks = saved; } catch { /* Use preview tasks when saved data is unavailable. */ }
function saveTasks() { try { localStorage.setItem('aether-tasks', JSON.stringify(tasks)); } catch { notify('无法保存到本地；本次更改仅保留在当前窗口。'); } }
function renderTasks() {
  const list = document.querySelector('#tasks'); list.replaceChildren();
  tasks.forEach((task, index) => {
    const row = document.createElement('div'); row.className = 'task-row';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `task-${index}`; checkbox.checked = task.done;
    const label = document.createElement('label'); label.htmlFor = checkbox.id; label.textContent = task.name;
    const time = document.createElement('time'); time.textContent = task.time;
    checkbox.addEventListener('change', () => { task.done = checkbox.checked; saveTasks(); });
    row.append(checkbox, label, time); list.append(row);
  });
}
document.querySelector('#add-task').addEventListener('submit', event => { event.preventDefault(); const input = event.currentTarget.querySelector('input'); const name = input.value.trim(); if (!name) return; tasks.push({ name, time: '', done: false }); saveTasks(); renderTasks(); input.value = ''; });
document.querySelector('#view-tasks').onclick = () => { document.querySelector('#add-task input').focus(); notify('所有任务已显示，可在下方添加任务。'); };
function updateClock() { const now = new Date(); document.querySelector('#date').textContent = new Intl.DateTimeFormat('en-NZ', { weekday:'short',day:'numeric',month:'short',year:'numeric' }).format(now); document.querySelector('#time').textContent = new Intl.DateTimeFormat('en-GB', {hour:'2-digit',minute:'2-digit'}).format(now); }
const audio = document.querySelector('#audio');
const audioFile = document.querySelector('#audio-file');
let audioUrl;
audio.volume = .4;
document.querySelector('#play').onclick = async () => {
  if (!audioUrl) { audioFile.click(); return; }
  if (audio.paused) { try { await audio.play(); } catch { notify('无法播放此音频文件。'); } } else audio.pause();
};
audioFile.onchange = async () => { const file = audioFile.files[0]; if (!file) return; if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(file); audio.src = audioUrl; document.querySelector('#track-name').textContent = file.name.replace(/\.[^.]+$/, ''); document.querySelector('#track-artist').textContent = 'Local audio'; try { await audio.play(); } catch { notify('无法播放此音频文件，请选择其他格式。'); } };
['play','pause','ended'].forEach(name => audio.addEventListener(name, () => { document.querySelector('#play').innerHTML = icon(audio.paused ? 'play' : 'pause'); document.querySelector('#play').setAttribute('aria-label',audio.paused ? 'Play audio' : 'Pause audio'); }));
document.querySelector('#volume').oninput = event => audio.volume = Number(event.target.value);
renderExplore(); renderTasks(); updateClock(); setInterval(updateClock, 1000);
refreshApps();
const seek = document.querySelector('#seek');
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,'0')}`;
function updateAudioPosition() { const ready = Number.isFinite(audio.duration) && audio.duration > 0; seek.disabled = !ready; seek.value = ready ? audio.currentTime / audio.duration * 100 : 0; document.querySelector('#elapsed').textContent = formatTime(audio.currentTime || 0); document.querySelector('#remaining').textContent = ready ? '-' + formatTime(Math.max(0,audio.duration-audio.currentTime)) : '—'; }
['timeupdate','loadedmetadata','emptied'].forEach(name=>audio.addEventListener(name,updateAudioPosition));
seek.oninput = () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value)/100*audio.duration; };
document.querySelector('#track-like').onclick = event => { const button = event.currentTarget; button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed') !== 'true')); };
renderRecent();
