const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const target = path.join(root, '.tauri-dist');
const entries = [
  'index.html', 'styles.css', 'home.css', 'catalog.js', 'storage.js',
  'renderer.js', 'hub-features.js', 'theme.js', 'app-host', 'assets'
];

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target);
for (const entry of entries) {
  fs.cpSync(path.join(root, entry), path.join(target, entry), { recursive: true });
}
console.log('Tauri frontend assets staged.');
