'use strict';
document.documentElement.dataset.theme=window.appStore?.theme?.()||'dark';
window.appStore?.onTheme?.(theme=>document.documentElement.dataset.theme=theme);
const $=s=>document.querySelector(s);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
let state;
function load(defaultValue){try{state=window.appStore?window.appStore.read():JSON.parse(localStorage.getItem('save'));if(state===null)state=defaultValue;}catch(error){$('#save-status').textContent='Cannot read save: '+error.message;$('#save-status').className='error';throw error;}return state;}
function save(){try{if(window.appStore)window.appStore.write(state);else localStorage.setItem('save',JSON.stringify(state));$('#save-status').textContent='Saved locally · '+new Date().toLocaleTimeString();$('#save-status').className='';return true;}catch(error){$('#save-status').textContent='Save failed: '+error.message;$('#save-status').className='error';return false;}}
function message(text){$('#message').textContent=text;}
function shell(html){$('main').innerHTML=html+'<p id="message" role="status"></p>';}
function resetGame(create){if(confirm('Start a new game? Your current board will be replaced.')){state=create();save();render();}}

window.addEventListener('beforeunload',()=>{if(state!==undefined&&state!==null)save();});
