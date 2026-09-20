import { readdir, readFile, writeFile } from 'node:fs/promises';
const folder = new URL('./upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/', import.meta.url);
const output = new URL('./public/images/', import.meta.url);
const sources = {};
for (const file of await readdir(folder)) {
  const source = await readFile(new URL(file, folder), 'utf8');
  for (const [url] of source.matchAll(/https:\/\/images\.unsplash\.com\/[^"'\s)]+/g)) {
    if (sources[url]) continue;
    const name = `original-${Object.keys(sources).length}.jpg`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    await writeFile(new URL(name, output), Buffer.from(await response.arrayBuffer()));
    sources[url] = './images/' + name;
  }
}
const response = await fetch('https://itunes.apple.com/search?term=Jimi%20Hendrix&entity=album&limit=100');
if (!response.ok) throw new Error(`iTunes ${response.status}`);
const { results } = await response.json();
const albums = [];
for (let i = 0; i < results.length; i += 6) {
  const batch = await Promise.all(results.slice(i, i + 6).map(async (album) => {
    const name = `album-${album.collectionId}.jpg`;
    const url = album.artworkUrl100.replace('/100x100bb.', '/600x600bb.');
    const image = await fetch(url);
    if (!image.ok) throw new Error(`Artwork ${image.status}: ${url}`);
    await writeFile(new URL(name, output), Buffer.from(await image.arrayBuffer()));
    sources[url] = './images/' + name;
    return { collectionId: album.collectionId, collectionName: album.collectionName, artistName: album.artistName, artworkUrl100: './images/' + name };
  }));
  albums.push(...batch);
}
await writeFile(new URL('sources.json', output), JSON.stringify(sources, null, 2));
await writeFile(new URL('albums.json', output), JSON.stringify(albums, null, 2));
for (const weight of [400, 500, 600, 700, 800]) {
  const font = await fetch(`https://raw.githubusercontent.com/kube/kube.io/bd091c537fd502f2d1d4d60817e6f05626508e6b/public/fonts/inter/Inter-${weight}.ttf`);
  if (!font.ok) throw new Error(`Inter ${weight}: ${font.status}`);
  await writeFile(new URL(`Inter-${weight}.ttf`, output), Buffer.from(await font.arrayBuffer()));
}
console.log(`Cached ${Object.keys(sources).length} original images, ${albums.length} albums.`);
