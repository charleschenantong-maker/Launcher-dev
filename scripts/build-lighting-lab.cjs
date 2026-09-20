const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'lighting-lab.html'),'utf8');
const source=html.match(/<script type="text\/plain" id="lighting-lab-source">([\s\S]*?)<\/script>/)?.[1];
if(!source)throw new Error('Lighting Lab source block not found');
esbuild.buildSync({stdin:{contents:source,resolveDir:root,sourcefile:'lighting-lab.js',loader:'js'},bundle:true,format:'iife',target:'chrome120',outfile:path.join(root,'assets/vendor/lighting-lab.bundle.js')});
console.log('Built assets/vendor/lighting-lab.bundle.js');
