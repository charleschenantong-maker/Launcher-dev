# Kube Liquid Glass

Original article: https://kube.io/blog/liquid-glass-css-svg/
Original source: https://github.com/kube/kube.io
Pinned commit: bd091c537fd502f2d1d4d60817e6f05626508e6b.

ui/kube-glass/upstream contains the author's components and optics, retained
without edits. No license file was present in this source snapshot; it is not
represented as MIT. The previous liquid-web implementation is no longer used.
Dependencies retain their own package licenses in node_modules.

The sidebar's Kube · 原版组件 entry opens all five original UI examples
(magnifying glass, searchbox, switch, slider, music player), all four surface
equations, parallax glass, refraction and displacement simulations, RGB vector
conversion, playground, specular preview and screen-to-eye diagram. The original
component dimensions, optical parameters, spring values and parameter panels
remain intact. The music player is the author's visual demo, not an audio service.
Its original default search results (98 albums) and background photos are cached
locally, with source URLs in public/images/sources.json and the author's credits
retained in the components. Offline search filters those cached albums.

Launcher controls use the author's dynamic Filter component, fitting its original
displacement/specular functions to their actual dimensions. Hard white borders
and inset white outlines were removed from controls and content modules.
Existing native input/button handlers and local audio remain connected.

Build-only adaptations live in vite.config.ts: inline the author's generated
PNG maps for offline use; replace remote photos/data with cached assets; add
switch keyboard/ARIA support and ignore unrelated global mouse releases; correct
the dynamic Filter's absent-magnification input and size its specular map with
the actual bezel width, matching the author's static plugin. The original source
files are unchanged. No separate refraction implementation is maintained.

Build from ui/kube-glass: pnpm install, then pnpm build.
Generated offline bundle: assets/vendor/kube-glass.
Verify from the repository root:
run-dev.bat

This is Kube's browser implementation running in Tauri WebView2, not Apple's native
compositor. Child app styling remains scoped to the bundled header/save-status
structure; gameplay and existing saves are unchanged.
