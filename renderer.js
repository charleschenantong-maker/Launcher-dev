const iconPaths = {
  "arrows": "<path d=\"m16 3 4 4-4 4\" />\n  <path d=\"M20 7H4\" />\n  <path d=\"m8 21-4-4 4-4\" />\n  <path d=\"M4 17h16\" />",
  "blocks": "<rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\" />\n  <path d=\"M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3\" />",
  "bomb": "<circle cx=\"11\" cy=\"13\" r=\"9\" />\n  <path d=\"M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95\" />\n  <path d=\"m22 2-1.5 1.5\" />",
  "book": "<path d=\"M12 7v14\" />\n  <path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\" />",
  "calendar": "<path d=\"M8 2v4\" />\n  <path d=\"M16 2v4\" />\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" />\n  <path d=\"M3 10h18\" />\n  <path d=\"M8 14h.01\" />\n  <path d=\"M12 14h.01\" />\n  <path d=\"M16 14h.01\" />\n  <path d=\"M8 18h.01\" />\n  <path d=\"M12 18h.01\" />\n  <path d=\"M16 18h.01\" />",
  "car": "<path d=\"m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8\" />\n  <path d=\"M7 14h.01\" />\n  <path d=\"M17 14h.01\" />\n  <rect width=\"18\" height=\"8\" x=\"3\" y=\"10\" rx=\"2\" />\n  <path d=\"M5 18v2\" />\n  <path d=\"M19 18v2\" />",
  "chart": "<path d=\"M12 16v5\" />\n  <path d=\"M16 14v7\" />\n  <path d=\"M20 10v11\" />\n  <path d=\"m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15\" />\n  <path d=\"M4 18v3\" />\n  <path d=\"M8 14v7\" />",
  "checklist": "<path d=\"m3 17 2 2 4-4\" />\n  <path d=\"m3 7 2 2 4-4\" />\n  <path d=\"M13 6h8\" />\n  <path d=\"M13 12h8\" />\n  <path d=\"M13 18h8\" />",
  "cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />",
  "coin": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8\" />\n  <path d=\"M12 18V6\" />",
  "creative": "<circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\" />\n  <circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\" />\n  <circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />\n  <circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\" />\n  <path d=\"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z\" />",
  "exercise": "<path d=\"M14.4 14.4 9.6 9.6\" />\n  <path d=\"M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z\" />\n  <path d=\"m21.5 21.5-1.4-1.4\" />\n  <path d=\"M3.9 3.9 2.5 2.5\" />\n  <path d=\"M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z\" />",
  "finance": "<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\" />\n  <path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\" />",
  "game": "<line x1=\"6\" x2=\"10\" y1=\"11\" y2=\"11\" />\n  <line x1=\"8\" x2=\"8\" y1=\"9\" y2=\"13\" />\n  <line x1=\"15\" x2=\"15.01\" y1=\"12\" y2=\"12\" />\n  <line x1=\"18\" x2=\"18.01\" y1=\"10\" y2=\"10\" />\n  <path d=\"M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z\" />",
  "grid": "<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\" />\n  <rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\" />\n  <rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\" />\n  <rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\" />",
  "heart": "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\" />",
  "home": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" />\n  <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />",
  "library": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />",
  "list": "<path d=\"M3 12h.01\" />\n  <path d=\"M3 18h.01\" />\n  <path d=\"M3 6h.01\" />\n  <path d=\"M8 12h13\" />\n  <path d=\"M8 18h13\" />\n  <path d=\"M8 6h13\" />",
  "music": "<circle cx=\"8\" cy=\"18\" r=\"4\" />\n  <path d=\"M12 18V2l7 4\" />",
  "note": "<path d=\"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4\" />\n  <path d=\"M2 6h4\" />\n  <path d=\"M2 10h4\" />\n  <path d=\"M2 14h4\" />\n  <path d=\"M2 18h4\" />\n  <path d=\"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\" />",
  "pause": "<rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" />\n  <rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" />",
  "pig": "<path d=\"M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z\" />\n  <path d=\"M2 9v1c0 1.1.9 2 2 2h1\" />\n  <path d=\"M16 11h.01\" />",
  "play": "<polygon points=\"6 3 20 12 6 21 6 3\" />",
  "productivity": "<path d=\"M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5\" />\n  <path d=\"m9 11 3 3L22 4\" />",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\" />\n  <path d=\"m21 21-4.3-4.3\" />",
  "settings": "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\" />\n  <circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />",
  "stats": "<line x1=\"12\" x2=\"12\" y1=\"20\" y2=\"10\" />\n  <line x1=\"18\" x2=\"18\" y1=\"20\" y2=\"4\" />\n  <line x1=\"6\" x2=\"6\" y1=\"20\" y2=\"16\" />",
  "study": "<path d=\"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z\" />\n  <path d=\"M22 10v6\" />\n  <path d=\"M6 12.5V16a6 3 0 0 0 12 0v-3.5\" />",
  "sudoku": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M3 9h18\" />\n  <path d=\"M3 15h18\" />\n  <path d=\"M9 3v18\" />\n  <path d=\"M15 3v18\" />",
  "timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" />\n  <line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" />\n  <circle cx=\"12\" cy=\"14\" r=\"8\" />",
  "tools": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\" />",
  "volume": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" />\n  <path d=\"M16 9a5 5 0 0 1 0 6\" />\n  <path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\" />",
  "zap": "<path d=\"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z\" />",
  "snake": "<path d=\"M20 16a4 4 0 0 1-4 4H8a5 5 0 0 1 0-10h8a3 3 0 0 0 0-6h-3a3 3 0 0 0 0 6\"/><path d=\"M15 6h.01M20 16l2-2\"/>"
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.grid}</svg>`; }
function appIcon(name) { return `<img class="app-icon" src="assets/icons/${name}.svg" alt="">`; }
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const nav = ['Home', ...CATEGORIES.slice(1), 'Favorite', 'Library', 'Stats', 'Settings'];
const navIcons = {Home:'home',Games:'game',Tools:'tools',Productivity:'productivity',Study:'study',Finance:'finance',Creative:'creative',Favorite:'star',Library:'library',Stats:'stats',Settings:'settings'};
document.querySelector('#navigation').innerHTML = nav.map((name,i)=>`${i===8 ? '<div class="nav-divider"></div>' : ''}<button class="nav-item ${i===0?'active':''}" data-nav="${name}" aria-label="${name}" ${i===0?'aria-current="page"':''}>${icon(navIcons[name])}<span>${name}</span></button>`).join('');
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let favorites = new Set(), recentIds = [];
try { const saved=JSON.parse(hubStorage.getItem('aether-favorites')); if(Array.isArray(saved))favorites=new Set(saved.filter(id=>typeof id==='string')); const recent=JSON.parse(hubStorage.getItem('aether-recent')); if(Array.isArray(recent))recentIds=recent.filter(id=>typeof id==='string').slice(0,4); } catch {}
let favoriteOnly=false, category='All', expanded=false, localApps=[], scanning=false;
function card(app,recent=false) {
  const subtitle=recent ? (app.lastOpened ? 'Last opened '+new Date(app.lastOpened).toLocaleString() : 'Ready to start')+' · '+app.category : app.detail;
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
async function refreshApps() { if(!window.launcher?.listApps||scanning)return;scanning=true;try{const result=await window.launcher.listApps();localApps=result.apps.filter(app=>!APPS.some(builtin=>builtin.id===app.slug));for(const builtin of APPS){const installed=result.apps.find(app=>app.slug===builtin.id);if(installed){builtin.playable=true;builtin.launchId=installed.id;}}renderExplore();renderRecent();if(result.errors.length)notify(result.errors.join(' / '));}catch{notify('无法读取 apps 目录。');}finally{scanning=false;} }
window.addEventListener('focus',refreshApps);
const dialog=document.querySelector('#app-dialog');
function details(name,description,image='grid',playable=false) { document.querySelector('#dialog-title').textContent=name;document.querySelector('#dialog-description').textContent=description;document.querySelector('#dialog-icon').innerHTML=appIcon(image);document.querySelector('#dialog-extra')?.remove();document.querySelector('.connection-status').textContent=playable?'本地应用 · 自动保存进度':'应用信息';dialog.showModal(); }
document.addEventListener('click',async event=>{
  const star=event.target.closest('[data-favorite]');
  if(star){const id=star.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);try{hubStorage.setItem('aether-favorites',JSON.stringify([...favorites]));}catch{notify('无法保存收藏。');}renderExplore();}
  const view=event.target.closest('[data-view]');
  if(view){document.querySelector('#explore').classList.toggle('grid-view',view.dataset.view==='grid');document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button===view)));}
  const more=event.target.closest('[data-details]');
  if(more){const app=[...localApps,...APPS].find(item=>item.id===more.dataset.details);details(app.name,app.detail,app.icon,app.playable);}
  const launch=event.target.closest('[data-app]');
  if(launch){const app=[...localApps,...APPS].find(item=>item.id===launch.dataset.app);if(app.playable){launch.disabled=true;try{const result=await window.launcher.openApp(app.launchId||app.id);if(result.error)notify(result.error);else{recentIds=[app.id,...recentIds.filter(id=>id!==app.id)].slice(0,4);try{hubStorage.setItem('aether-recent',JSON.stringify(recentIds));}catch{notify('无法保存最近打开记录。');}renderRecent();}}catch{notify('应用启动失败，请重试。');}finally{launch.disabled=false;}}else details(app.name,app.detail,app.icon);}
  const filter=event.target.closest('[data-category]');if(filter)setCategory(filter.dataset.category);
  const navigation=event.target.closest('[data-nav]');
  if(navigation){const name=navigation.dataset.nav;if(name==='Home'){expanded=false;document.querySelector('#search').value='';setCategory('All');}else if(CATEGORIES.includes(name))setCategory(name);else if(name==='Library'){expanded=true;setCategory('All');selectNav('Library');}else if(name==='Favorite'){category='All';favoriteOnly=true;selectNav(name);renderExplore();}else showHubPage(name);}
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
    try { hubStorage.setItem('aether-theme',theme); } catch { notify('无法保存外观设置。'); }
    try { await window.launcher?.setTheme(theme); } catch { notify('窗口材质切换失败，请重新打开启动台。'); }
    closeAppearance();
  };
});
document.addEventListener('click',event=>{if(!event.target.closest('#appearance,#profile'))closeAppearance();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!appearance.hidden){closeAppearance();document.querySelector('#profile').focus();}});
document.addEventListener('keydown',event=>{if(!dialog.open&&((event.key.toLowerCase()==='k'&&(event.ctrlKey||event.metaKey))||(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)))){event.preventDefault();document.querySelector('#search').focus();}});
let toastTimer;
function notify(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3500);}

const initialTasks = [];
let tasks = initialTasks.map(task => ({...task}));
try { const saved = JSON.parse(hubStorage.getItem('aether-tasks')); if (Array.isArray(saved) && saved.every(task => task && typeof task.name === 'string' && typeof task.time === 'string' && typeof task.done === 'boolean')) tasks = saved; } catch { /* Use preview tasks when saved data is unavailable. */ }
function saveTasks() { try { hubStorage.setItem('aether-tasks', JSON.stringify(tasks)); } catch { notify('无法保存到本地；本次更改仅保留在当前窗口。'); } }
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
document.querySelector('#view-tasks').onclick = () => showTaskManager();
function updateClock() { const now = new Date(); document.querySelector('#date').textContent = new Intl.DateTimeFormat('en-NZ', { weekday:'short',day:'numeric',month:'short',year:'numeric' }).format(now); document.querySelector('#time').textContent = new Intl.DateTimeFormat('en-GB', {hour:'2-digit',minute:'2-digit'}).format(now); }
renderExplore(); renderTasks(); updateClock(); setInterval(updateClock, 1000); refreshApps(); renderRecent();
