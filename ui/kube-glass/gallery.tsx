import React from 'react';
import { createRoot } from 'react-dom/client';
import { ParallaxImageHero } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/ParallaxImageHero';
import { MagnifyingGlass } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/MagnifyingGlass';
import { Searchbox } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/Searchbox';
import { Switch } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/Switch';
import { Slider } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/Slider';
import { MixedUI } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/MixedUI';
import { RefractionAnglesExplanation } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/RefractionAnglesExplanation';
import { RayRefractionSimulation } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/RayRefractionSimulation';
import { DisplacementVectorField } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/DisplacementVectorField';
import { VectorToRedGreen } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/VectorToRedGreen';
import { Playground } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/Playground';
import { SpecularPreview } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/SpecularPreview';
import { ScreenLightToEyeDiagram } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/ScreenLightToEyeDiagram';
import { FunctionPlot } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/components/Functions';
import { CONVEX_CIRCLE, CONVEX, CONCAVE, LIP } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/lib/surfaceEquations';
import './gallery.css';

const demos = [
  ['magnifying-glass', 'Magnifying Glass', MagnifyingGlass],
  ['searchbox', 'Searchbox', Searchbox],
  ['switch', 'Switch', Switch],
  ['slider', 'Slider', Slider],
  ['music-player', 'Music Player', MixedUI],
  ['parallax', 'Parallax Glass', ParallaxImageHero],
  ['refraction', 'Refraction Angles', RefractionAnglesExplanation],
  ['surface-equations', 'Surface Equations', () => <div className="grid grid-cols-2 gap-8">{[CONVEX_CIRCLE, CONVEX, CONCAVE, LIP].map((surface, i) => <div key={i}><h3>{['Convex Circle', 'Convex Squircle', 'Concave', 'Lip'][i]}</h3><FunctionPlot fn={surface.fn}/></div>)}</div>],
  ['ray-simulation', 'Ray Refraction', RayRefractionSimulation],
  ['displacement', 'Displacement Vector Field', DisplacementVectorField],
  ['red-green', 'Vector to Red–Green', VectorToRedGreen],
  ['playground', 'Playground', Playground],
  ['specular', 'Specular Highlight', SpecularPreview],
  ['screen-light', 'Screen Light to Eye', ScreenLightToEyeDiagram],
] as const;

createRoot(document.getElementById('root')!).render(<>
  <header className="gallery-heading"><div><p>KUBE / ORIGINAL COMPONENTS</p><h1>Liquid Glass</h1></div><button onClick={() => document.documentElement.classList.toggle('dark')}>Light / Dark</button></header>
  <nav aria-label="Components">{demos.map(([id, title]) => <a key={id} href={'#' + id}>{title}</a>)}</nav>
  <main>{demos.map(([id, title, Demo]) => <section id={id} key={id}><h2>{title}</h2><Demo/>{id === 'music-player' && <p className="caption">Original visual demo · locally cached album artwork · playback buttons demonstrate UI states.</p>}</section>)}</main>
  <footer>Original components by <a href="https://kube.io/blog/liquid-glass-css-svg/" target="_blank" rel="noreferrer">Kube</a> · source snapshot bd091c5. All optics and component parameters retained.</footer>
</>);
