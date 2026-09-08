load({notes:[],selected:null});
shell('<div class="toolbar"><button id="new">New note</button><input id="search-notes" placeholder="Search notes" aria-label="Search notes"></div><div class="split"><div id="notes" class="panel"></div><section id="editor" class="panel"></section></div>');
function render(){
  const query=$('#search-notes').value.toLowerCase();
  $('#notes').innerHTML=state.notes.filter(n=>(n.title+' '+n.body).toLowerCase().includes(query)).map(n=>`<div class="row"><button class="grow ${n.id===state.selected?'selected':''}" data-note="${n.id}">${esc(n.title||'Untitled')}</button></div>`).join('')||'<p>No notes yet.</p>';
  const note=state.notes.find(n=>n.id===state.selected);
  $('#editor').innerHTML=note?'<input id="title" class="note-title" aria-label="Note title" placeholder="Untitled"><textarea id="body" aria-label="Note content" placeholder="Start writing..."></textarea><div class="toolbar"><button id="export">Export .txt</button><button id="delete" class="danger">Delete note</button><span id="words" class="muted"></span></div>':'<p>Create a note to begin. Every edit is saved locally.</p>';
  if(!note)return;
  $('#title').value=note.title;$('#body').value=note.body;
  function count(){$('#words').textContent=note.body.trim()?note.body.trim().split(/\s+/).length+' words':'0 words';}count();
  for(const key of ['title','body'])$('#'+key).oninput=e=>{note[key]=e.target.value;note.updated=Date.now();save();count();const b=document.querySelector(`[data-note="${note.id}"]`);if(b)b.textContent=note.title||'Untitled';};
  $('#delete').onclick=()=>{if(!confirm('Delete this note?'))return;state.notes=state.notes.filter(n=>n.id!==note.id);state.selected=state.notes[0]?.id||null;save();render();};
  $('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([note.body],{type:'text/plain'}));a.download=(note.title||'Untitled').replace(/[<>:"/\\|?*]/g,'_')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
}
$('#new').onclick=()=>{const note={id:crypto.randomUUID(),title:'',body:'',updated:Date.now()};state.notes.unshift(note);state.selected=note.id;save();render();$('#title').focus();};
$('#search-notes').oninput=render;
$('#notes').onclick=e=>{const b=e.target.closest('[data-note]');if(b){state.selected=b.dataset.note;save();render();}};
render();
