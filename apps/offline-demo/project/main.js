const output = document.querySelector('#count');
const status = document.querySelector('#status');
let count = 0;
try { const saved = Number(localStorage.getItem('count')); if (Number.isSafeInteger(saved) && saved >= 0) count = saved; } catch { status.textContent = '本地存储不可用，计数仅保留到关闭窗口。'; }
output.textContent = count;
try { const data = await (await fetch('./data.json')).json(); status.textContent = data.message; } catch { status.textContent = '本地数据读取失败，请检查 project/data.json。'; }
function update(value) { count = value; output.textContent = count; try { localStorage.setItem('count',String(count)); } catch { status.textContent = '无法保存计数，当前窗口仍可使用。'; } }
document.querySelector('#increment').onclick = () => update(count < Number.MAX_SAFE_INTEGER ? count + 1 : count);
document.querySelector('#reset').onclick = () => update(0);
