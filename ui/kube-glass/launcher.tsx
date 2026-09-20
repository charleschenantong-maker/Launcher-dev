import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Filter } from './upstream/app/data/articles/2025_10_04_liquid_glass_css_svg/components/Filter';

// Native controls retain their event handlers. Only the material is a React island.
function Material({ target, width, height, id }) {
  const radius = Math.min(parseFloat(getComputedStyle(target).borderRadius) || 20, width / 2, height / 2);
  const pressed = useMotionValue(0);
  const focused = useMotionValue(0);
  const amount = useSpring(useTransform(() => Math.max(pressed.get(), focused.get())), { damping: 80, stiffness: 2000 });
  const scaleRatio = useTransform(amount, [0, 1], [.7, .9]);
  const tint = useTransform(amount, [0, 1], ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.2)']);
  const large = target.matches('.sidebar, .appearance, dialog');
  useEffect(() => {
    const down = () => pressed.set(1), up = () => pressed.set(0);
    const focus = () => focused.set(1), blur = () => focused.set(0);
    target.addEventListener('pointerdown', down);
    target.addEventListener('focusin', focus);
    target.addEventListener('focusout', blur);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      target.removeEventListener('pointerdown', down);
      target.removeEventListener('focusin', focus);
      target.removeEventListener('focusout', blur);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [target]);
  return <>
    <Filter id={id} width={width} height={height} radius={radius} bezelWidth={Math.min(radius, 27)} glassThickness={70} refractiveIndex={1.5} blur={large ? 8 : 1} scaleRatio={scaleRatio} specularOpacity={.2} specularSaturation={4} dpr={2}/>
    <motion.div className="kube-material-layer" style={{ borderRadius: 'inherit', position: 'absolute', inset: 0, backdropFilter: `url(#${id})`, backgroundColor: large ? 'var(--material-tint)' : tint }}/>
  </>;
}

const selector = '.sidebar, .search, .profile, .filters, .view-switch, .appearance, #app-dialog, .open-app, #back';
const surfaces = new Map();
let serial = 0;
function draw(target) {
  const entry = surfaces.get(target);
  const width = target.clientWidth, height = target.clientHeight;
  if (!entry || !width || !height || entry.size === `${width}:${height}`) return;
  entry.size = `${width}:${height}`;
  entry.root.render(<Material key={entry.size} target={target} width={width} height={height} id={entry.id}/>);
}
// ponytail: resize maps only after layout settles; a worker is unnecessary at these sizes.
let timer;
const resize = new ResizeObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => { for (const target of surfaces.keys()) draw(target); }, 100);
});
function sync() {
  for (const [target, entry] of surfaces) if (!target.isConnected || !entry.element.isConnected) {
    resize.unobserve(target); entry.root.unmount(); surfaces.delete(target);
  }
  for (const target of document.querySelectorAll(selector)) {
    if (surfaces.has(target)) continue;
    const element = document.createElement('div');
    element.className = 'glass-material'; element.setAttribute('aria-hidden', 'true');
    target.classList.add('glass-surface'); target.append(element);
    surfaces.set(target, { element, root: createRoot(element), id: `kube-material-${++serial}` });
    resize.observe(target); draw(target);
  }
}
let pending = false;
new MutationObserver(() => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; sync(); });
}).observe(document.body, { childList: true, subtree: true });
sync();

const open = document.querySelector('#kube-originals');
const gallery = document.querySelector<HTMLDialogElement>('#kube-gallery-dialog');
open?.addEventListener('click', () => {
  const frame = gallery!.querySelector('iframe')!;
  if (!frame.src) frame.src = import.meta.url.slice(0, import.meta.url.lastIndexOf('/') + 1) + 'index.html';
  gallery!.showModal();
});
gallery?.querySelector('button')?.addEventListener('click', () => gallery.close());
