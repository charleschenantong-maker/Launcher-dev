const name = new URLSearchParams(location.search).get('name');
document.title = name + ' — Aether Hub';
document.querySelector('#name').textContent = name;
document.querySelectorAll('[data-action]').forEach(button => button.onclick = () => window.host.control(button.dataset.action));
