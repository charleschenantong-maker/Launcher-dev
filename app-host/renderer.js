const name = new URLSearchParams(location.search).get('name');
document.documentElement.dataset.theme=window.host.theme();
window.host.onTheme(theme=>document.documentElement.dataset.theme=theme);
document.title = name + ' — Aether Hub';
document.querySelector('#name').textContent = name;
if(new URLSearchParams(location.search).get('network')==='rates')document.querySelector('header>span').textContent='LOCAL · REFERENCE RATES';
document.querySelectorAll('[data-action]').forEach(button => button.onclick = () => window.host.control(button.dataset.action));
