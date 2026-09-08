# Aether Hub 1.2

Run `run-dev.bat` to open the local Electron launcher.

17 working apps: 2048, Study Planner, Savings Tracker, Tetris, Pomodoro, Minesweeper, Snake, Sudoku, NotePad, Habit Tracker, Currency Converter, Breakout, Hotswap, Wordle, Chess, Pac-Man and Reaction Time Test. Chess supports two players, automatic board rotation, checkmate notices and captured material. Applicable games have Easy / Medium / Hard choices.

Favorites, tasks, settings, activity, local music position and app progress are saved under Electron's userData `saves/` directory (shown in Settings). Writes are atomic with a backup; closing and reopening the launcher preserves progress. Continuous games checkpoint every 250–500 ms and music every second, so forced termination can lose that small interval. Games resume paused.

Only weather (Open-Meteo) and reference exchange rates (Frankfurter) use the network. Game engines, fonts, word lists and rules are bundled locally with their licenses. Offline Demo has been removed at the user's request. The supplied Hotswap source outside this repository is unchanged.

Each app is a self-contained `apps/<slug>/` folder. See [apps/README.md](apps/README.md). The isolated runtime in `app-host/` denies external requests and cross-app file access. No app gets Node access.

Dark/light themes use Windows native Acrylic. Images remain replaceable assets; SVG icon corners are transparent. Settings/Stats dialogs scroll within the window, and list/grid views adapt to restored windows. Startup opens Electron directly and shows the launcher at its first ready frame; app windows load shell and content concurrently without waiting on hidden animation frames.

Checks:
- `node scripts/check-modules.cjs`: all 17 apps, isolation, forced-process-termination and save restoration.
- `node node_modules/electron/cli.js scripts/ui-check.cjs`: real window screenshots, app opening times, compact dialogs/grid, chess captures/checkmate.
- `node node_modules/electron/cli.js scripts/apps-smoke.cjs`: manifests and local protocol boundaries.

`node scripts/generate-icons.js` regenerates icons from local Lucide SVG sources in `assets/ui/` and custom game glyphs. Local third-party licenses accompany Lucide, Three.js, fonts, chess.js and the Wordle dictionary.
