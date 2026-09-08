const fs = require('node:fs/promises');
const path = require('node:path');

async function localFile(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes(':')) throw new Error('入口必须是应用目录内的相对路径');
  const base = await fs.realpath(root);
  const file = await fs.realpath(path.resolve(base, relative));
  const rel = path.relative(base, file);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel) || !(await fs.stat(file)).isFile()) throw new Error('文件超出应用目录或不是普通文件');
  return file;
}

async function scanApps(root) {
  await fs.mkdir(root, { recursive: true });
  const apps = [], errors = [];
  await Promise.all((await fs.readdir(root, { withFileTypes: true })).map(async dir => {
    if (!dir.isDirectory() || dir.name.startsWith('.')) return;
    try {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(dir.name)) throw new Error('文件夹名只支持小写字母、数字和连字符');
      const folder = path.join(root, dir.name);
      const manifest = JSON.parse(await fs.readFile(await localFile(folder, 'app.json'), 'utf8'));
      if (typeof manifest.name !== 'string' || !manifest.name.trim()) throw new Error('app.json 缺少 name');
      const entry = manifest.entry || 'project/index.html';
      const target = await localFile(folder, entry);
      if (!/\.html?$/i.test(target)) throw new Error('入口必须是 HTML 文件');
      let cover;
      if (manifest.cover) {
        const file = await localFile(folder, manifest.cover);
        const mime = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' }[path.extname(file).toLowerCase()];
        if (!mime || (await fs.stat(file)).size > 5 * 1024 * 1024) throw new Error('封面须为不超过 5 MB 的 PNG/JPEG/WebP/SVG');
        cover = `data:${mime};base64,${(await fs.readFile(file)).toString('base64')}`;
      }
      apps.push({ id: `local-${dir.name}`, slug: dir.name, name: manifest.name.slice(0,100), detail: typeof manifest.description === 'string' ? manifest.description.slice(0,200) : 'Local app · Offline', category: ['Games','Tools','Productivity','Study','Finance','Creative'].includes(manifest.category) ? manifest.category : 'Tools', entry, folder, cover, icon:'grid', tone:'teal', playable:true, explore:true });
    } catch (error) { errors.push(`${dir.name}: ${error.message}`); }
  }));
  apps.sort((a,b)=>a.slug.localeCompare(b.slug));
  return { apps, errors };
}
module.exports = { scanApps, localFile };
