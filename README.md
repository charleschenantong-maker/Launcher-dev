# Aether Hub

Local apps now live in `apps/<app-name>/` and are discovered automatically at startup and on window focus. See [apps/README.md](apps/README.md) for the manifest and folder format. `app-host/` contains the shared isolated offline runtime and window controls. The included Offline Demo runs without internet; other original catalog entries remain previews. This runtime serves static HTML projects, not backend processes, and never downloads dependencies automatically.

Run `node node_modules/electron/cli.js scripts/apps-smoke.cjs` to verify discovery, local modules/fetch, offline enforcement, path boundaries, isolation, and return navigation. Only its uniquely named temporary test fixture is cleaned up; real apps and Offline Demo remain.

Run `run-dev.bat` to open the Electron launcher.

This first version recreates the reference as actual HTML controls and CSS layout. Games and tools currently open an explicitly labelled preview; they are not implemented games or connected services. Search, category filtering, local task storage, the clock, local audio playback, and native window controls work. Weather, progress, and recent activity use preview data.

- `main.js`: Electron window and restricted window-control IPC.
- `preload.js`: isolated, allowlisted window-control bridge.
- `index.html` / `styles.css`: semantic layout and appearance.
- `catalog.js`: app IDs and metadata; add future apps here.
- `renderer.js`: UI behavior; `data-app` routes to the app launch boundary.
- `assets/landscape.png`: independent AI-generated background and music artwork.
- `assets/avatar.svg`: independent editable avatar illustration.
- `assets/icons/*.svg`: independent app icons, editable directly or regenerated with `node scripts/generate-icons.js`.

All images are local and replaceable. The interface is not a flattened screenshot. Set `--wallpaper: none` in `styles.css` to remove the background imagery; the layout still works. Replace the avatar or individual icons at the same paths without touching app logic.

Run `node node_modules/electron/cli.js scripts/smoke.cjs` for the Electron renderer smoke check. It checks search, categories, empty state, app details, task editing, safe text rendering, asset loading, and compact width. The screenshot is written to `output/launcher-preview.png`.
