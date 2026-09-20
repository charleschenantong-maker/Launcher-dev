import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import originalPlugin from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/vitePlugin.ts';

const optics = originalPlugin();
const images = JSON.parse(readFileSync(new URL('./public/images/sources.json', import.meta.url), 'utf8'));
const albums = JSON.parse(readFileSync(new URL('./public/images/albums.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  oxc: { jsx: { runtime: 'automatic' } },
  plugins: [tailwindcss(), {
    ...optics,
    async load(id) {
      const result = await optics.load.call(this, id);
      if (!result) return;
      // Preserve the author's generated pixels; inline URLs for offline/file:// use.
      const assets = new Map();
      optics.generateBundle.call({ emitFile(asset) {
        assets.set(asset.fileName, 'data:image/png;base64,' + asset.source.toString('base64'));
      }});
      return { ...result, code: result.code.replace(/"\/(assets\/[^"\s]+)"/g, (_, name) => JSON.stringify(assets.get(name))) };
    },
    generateBundle() {},
  }, {
    name: 'local-kube-adaptations',
    enforce: 'pre',
    transform(source, id) {
      if (!id.includes('/upstream/')) return;
      source = source.replaceAll('\r\n', '\n');
      for (const [url, local] of Object.entries(images)) source = source.replaceAll(url, local);
      if (id.endsWith('/MixedUI.tsx')) {
        source = source.replace(/function fetchAlbums\(term: string\): Promise<Album\[\]> \{[\s\S]*?\n\}/,
          `function fetchAlbums(term: string): Promise<Album[]> {
            const albums = ${JSON.stringify(albums)};
            return Promise.resolve(albums.filter(a => (a.artistName + ' ' + a.collectionName).toLowerCase().includes(term.toLowerCase())));
          }`);
      }
      if (id.endsWith('/Filter.tsx')) {
        // The unused MotionValue is truthy even without magnification.
        source = source.replaceAll('magnifyingDisplacementMapDataUrl\n', '(magnifyingScale !== undefined)\n');
        source = source.replace('      50,', '      getValueOrMotion(bezelWidth),');
      }
      if (id.endsWith('/Switch.tsx')) {
        source = source.replace('  const checked = useMotionValue(1);', `  const checked = useMotionValue(1);
  const [a11yChecked, setA11yChecked] = React.useState(true);
  useEffect(() => checked.on('change', v => setA11yChecked(v > .5)), [checked]);`);
        source = source.replace('      pointerDown.set(0);', '      if (!pointerDown.get()) return;\n      pointerDown.set(0);');
        source = source.replace('          ref={sliderRef}', `          ref={sliderRef}
          role="switch" tabIndex={0} aria-label="Glass switch"
          aria-checked={a11yChecked}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); checked.set(checked.get() ? 0 : 1); } }}`);
      }
      return source;
    },
  }],
  build: {
    outDir: '../../assets/vendor/kube-glass',
    emptyOutDir: true,
    rolldownOptions: {
      input: { gallery: 'index.html', launcher: 'launcher.tsx' },
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});
