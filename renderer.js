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
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.grid || iconPaths.tools}</svg>`; }
function appIcon(name) { return `<img class="app-icon" src="assets/icons/${name}.svg" alt="">`; }
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const nav = ['Home', ...CATEGORIES.slice(1), 'Library', 'Stats', 'Settings'];
document.querySelector('#navigation').innerHTML = nav.map((name, i) => `${i === 7 ? '<div class="nav-divider"></div>' : ''}<button class="nav-item ${i === 0 ? 'active' : ''}" data-nav="${name}" aria-label="${name}" ${i === 0 ? 'aria-current="page"' : ''}>${icon(({Games:'game',Tools:'tools',Productivity:'productivity',Study:'study',Finance:'finance',Creative:'creative',Library:'library',Stats:'stats',Settings:'settings',Home:'home'})[name])}<span>${name}</span></button>`).join('');
document.querySelector('#quick-launch').innerHTML = QUICK.map(item => `<button class="quick-card ${item.tone}" ${item.app ? `data-app="${item.app}"` : `data-category="${item.category}"`}>${appIcon(item.icon)}<strong>${item.name}</strong><small>${item.detail}</small></button>`).join('');
function card(app, recent = false) { return `<button class="app-card ${app.tone}" data-app="${app.id}" aria-label="${app.name}, app preview">${recent ? '<span class="dots" aria-hidden="true">···</span>' : ''}${appIcon(app.icon)}<strong>${app.name}</strong><small>${recent ? app.recent : app.detail}</small></button>`; }
document.querySelector('#recent').innerHTML = APPS.filter(app => app.recent).map(app => card(app, true)).join('');
let category = 'All';
let expanded = false;
function renderExplore() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const apps = APPS.filter(app => (category === 'All' || app.category === category) && (!query || `${app.name} ${app.category} ${app.detail}`.toLowerCase().includes(query)) && (expanded || query || category !== 'All' || app.explore));
  document.querySelector('#explore').innerHTML = apps.map(app => card(app)).join('');
  document.querySelector('#empty').hidden = apps.length > 0;
  document.querySelector('#filters').innerHTML = CATEGORIES.map(name => `<button data-category="${name}" class="${category === name ? 'active' : ''}" aria-pressed="${category === name}">${name}</button>`).join('');
  document.querySelector('#view-all').textContent = expanded ? 'Show Less' : 'View All';
}
function setCategory(name) {
  category = name;
  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === (name === 'All' ? 'Home' : name);
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  renderExplore();
}
const dialog = document.querySelector('#app-dialog');
function details(name, description, image = 'grid') {
  document.querySelector('#dialog-title').textContent = name;
  document.querySelector('#dialog-description').textContent = description;
  document.querySelector('#dialog-icon').innerHTML = appIcon(image);
  dialog.showModal();
}
document.addEventListener('click', event => {
  const launch = event.target.closest('[data-app]');
  if (launch) {
    const app = APPS.find(item => item.id === launch.dataset.app);
    // Future functional modules enter through this single launch boundary.
    details(app.name, app.detail, app.icon);
  }
  const filter = event.target.closest('[data-category]');
  if (filter) setCategory(filter.dataset.category);
  const navigation = event.target.closest('[data-nav]');
  if (navigation) {
    const name = navigation.dataset.nav;
    if (name === 'Home') { expanded = false; document.querySelector('#search').value = ''; setCategory('All'); }
    else if (CATEGORIES.includes(name)) setCategory(name);
    else if (name === 'Library') { expanded = true; setCategory('All'); }
    else details(name, name === 'Settings' ? '个性化设置将在后续接入。图片、应用目录与界面样式已独立存放。' : '活动统计将在连接真实应用后显示。');
  }
  const control = event.target.closest('[data-window]');
  if (control) window.launcher?.controlWindow(control.dataset.window);
});
document.querySelector('#search').addEventListener('input', renderExplore);
document.querySelector('#view-all').addEventListener('click', () => { expanded = !expanded; renderExplore(); });
document.querySelector('#close-dialog').onclick = document.querySelector('#dialog-done').onclick = () => dialog.close();
dialog.addEventListener('click', event => { if (event.target === dialog && !event.target.closest('button')) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
document.querySelector('#profile').onclick = () => details('你好, Charles', 'Your own space to play, create, and improve.');
document.addEventListener('keydown', event => { if (event.key === '/' && !dialog.open && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); document.querySelector('#search').focus(); } });
let toastTimer;
function notify(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 3500); }
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
