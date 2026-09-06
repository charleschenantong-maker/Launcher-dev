const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(async () => {
  const window = new BrowserWindow({width:1536,height:1024,frame:false,show:false,webPreferences:{contextIsolation:true,sandbox:true}});
  const errors = [];
  window.webContents.on('console-message', (event) => { if (event.level === 'error') errors.push(event.message); });
  try {
    await window.loadFile(path.join(__dirname,'..','index.html'));
    const result = await window.webContents.executeJavaScript(`(async () => {
      await Promise.all([...document.images].map(img => img.decode()));
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      check(document.querySelectorAll('#recent .app-card').length === 6, 'recent cards');
      check(document.querySelectorAll('#explore .app-card').length === 6, 'explore cards');
      document.querySelector('#search').value = 'sudoku'; document.querySelector('#search').dispatchEvent(new Event('input'));
      check(document.querySelectorAll('#explore .app-card').length === 1, 'search');
      document.querySelector('#explore .app-card').click(); check(document.querySelector('dialog').open, 'app detail');
      document.querySelector('#close-dialog').click();
      document.querySelector('#search').value = ''; document.querySelector('#search').dispatchEvent(new Event('input'));
      document.querySelector('[data-nav="Finance"]').click(); check(document.querySelectorAll('#explore .app-card').length === 2, 'category');
      document.querySelector('[data-nav="Creative"]').click(); check(!document.querySelector('#empty').hidden, 'empty state');
      document.querySelector('[data-nav="Home"]').click();
      const checkbox = document.querySelector('#tasks input'); const before = checkbox.checked; checkbox.click(); check(checkbox.checked !== before, 'task checkbox'); checkbox.click();
      const original = localStorage.getItem('aether-tasks');
      const count = document.querySelectorAll('.task-row').length;
      document.querySelector('#add-task input').value = '<script>test</script>'; document.querySelector('#add-task').requestSubmit();
      check(document.querySelectorAll('.task-row').length === count + 1, 'add task');
      check(document.querySelector('.task-row:last-child label').textContent === '<script>test</script>', 'safe task text');
      localStorage.setItem('aether-tasks', original); tasks.pop(); renderTasks();
      check(document.documentElement.scrollWidth <= innerWidth, 'horizontal overflow');
      const shell = document.querySelector('.shell').getBoundingClientRect();
      check(shell.x === 0 && shell.y === 0 && Math.abs(shell.width - document.documentElement.clientWidth) <= 1, 'shell fills window without wallpaper margins');
      check(getComputedStyle(document.body).backgroundImage === 'none', 'no outer wallpaper');
      return {recent:6, explore:6, search:true, filter:true, dialog:true, tasks:true, width:innerWidth};
    })()`);
    fs.mkdirSync(path.join(__dirname,'..','output'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,'..','output','launcher-preview.png'), (await window.webContents.capturePage()).toPNG());
    await window.setSize(1000,760);
    const compact = await window.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth');
    assert.ok(compact, 'compact layout has no horizontal overflow');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({...result,compact,errors})); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});

