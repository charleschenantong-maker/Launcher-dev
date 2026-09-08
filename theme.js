// Set page colors before first paint; the isolated bridge updates native Acrylic too.
let savedTheme = 'dark';
try { if (hubStorage.getItem('aether-theme') === 'light') savedTheme = 'light'; } catch {}
document.documentElement.dataset.theme = savedTheme;
window.launcher?.setTheme(savedTheme).catch(() => {});
