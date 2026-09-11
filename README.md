# Aether Hub 1.2

Run `run-dev.bat` to open the local Tauri 2 launcher.

17 working apps: 2048, Study Planner, Savings Tracker, Tetris, Pomodoro, Minesweeper, Snake, Sudoku, NotePad, Habit Tracker, Currency Converter, Breakout, Hotswap, Wordle, Chess, Pac-Man and Reaction Time Test. Chess supports two players, automatic board rotation, checkmate notices and captured material. Applicable games have Easy / Medium / Hard choices.

Favorites, tasks, settings, activity, local music position and app progress are saved under Tauri's app-data `saves/` directory (shown in Settings). Writes are atomic with a backup; closing and reopening the launcher preserves progress. Continuous games checkpoint every 250–500 ms and music every second, so forced termination can lose that small interval. Games resume paused.

Only weather (Open-Meteo) and reference exchange rates (Frankfurter) use the network. Game engines, fonts, word lists and rules are bundled locally with their licenses. Offline Demo has been removed at the user's request. The supplied Hotswap source outside this repository is unchanged.

Each app is a self-contained `apps/<slug>/` folder. See [apps/README.md](apps/README.md). The Rust runtime in `src-tauri/` serves each app through an isolated local protocol that denies external requests and cross-app file access. No app gets Node access.

Dark/light themes use Windows native Acrylic. Images remain replaceable assets; SVG icon corners are transparent. Settings/Stats dialogs scroll within the window, and list/grid views adapt to restored windows. Tauri loads the existing launcher frontend unchanged; app windows keep the shared `app-host/` shell and load content from `apps/<slug>/project/`.

Checks:
- `cargo test --manifest-path src-tauri/Cargo.toml`: path, hostname and local-navigation boundaries.
- `pnpm build`: optimized Windows executable plus MSI and NSIS installers.

`node scripts/generate-icons.js` regenerates icons from local Lucide SVG sources in `assets/ui/` and custom game glyphs. Local third-party licenses accompany Lucide, Three.js, fonts, chess.js and the Wordle dictionary.
