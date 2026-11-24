# Rigdle

A daily "-dle" puzzle about building a gaming PC (personal computer). Each day you get one Steam game and a target FPS (frames per second). In 6 guesses, pick the **minimum** CPU (central processing unit), GPU (graphics processing unit) and RAM (random access memory) that reach the target at 1080p High. Overkill counts as wrong.

Everything runs client-side: no backend, no accounts. Progress and stats live in `localStorage`.

## Setup

Requires Node.js 20+.

```bash
npm install
npm run dev               # local dev server at http://localhost:5173
npm test                  # unit tests (Vitest)
npm run validate-puzzles  # check the next 365 days of puzzles
npm run build             # type-check + static build into dist/
npm run preview           # serve dist/ locally
```

`validate-puzzles` accepts `-- --days 730 --start 2027-01-01`. It prints the distribution of games, FPS targets and answer parts, lists any game that can never produce a valid puzzle, and exits non-zero if any puzzle is invalid, repeats a game within 30 days, or the set isn't varied enough.

## Deploy

The build uses relative asset paths (`base: './'` in `vite.config.ts`), so the same `dist/` works at a domain root or under a sub-path.

**GitHub Pages:** in the repository go to *Settings → Pages → Source* and choose **GitHub Actions**. Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, validates puzzles, builds and publishes `dist/`.

**Vercel:** import the repository. The defaults are detected (framework Vite, build `npm run build`, output `dist`). Nothing else to configure.

## Project layout

```
src/
  data/            games.json, cpus.json, gpus.json, ram.json  (editable)
  lib/
    config.ts      all tunables: launch date, FPS targets, resolution/preset, penalties
    rng.ts         string hash + mulberry32 PRNG (pseudo-random number generator)
    date.ts        local date keys, puzzle numbers, countdown
    data.ts        loads JSON and sorts parts weakest -> strongest (list index = tier)
    fps.ts         the FPS model
    solver.ts      minimum-build solver
    puzzle.ts      daily generation, validity + reroll rules, 30-day no-repeat
    feedback.ts    tiles (green/yellow/gray + arrows), ruled-out ranges
    share.ts       share text
    storage.ts     localStorage state + stats
    validate.ts    sequence analysis used by the script and tests
  components/      React UI
scripts/validate-puzzles.ts
```

## How it works

### Daily puzzle
- Puzzle number = days since `LAUNCH_DATE` + 1 (`2026-12-01` is #1). Earlier dates show as "Preview".
- A PRNG is seeded with a hash of the local date string `YYYY-MM-DD`. It picks a game, then a target from `[30, 60, 90, 120, 144, 165, 240]`.
- If the candidate is invalid (target unreachable, or any part's answer is the weakest or strongest option) or the game appeared in the previous 30 days, the same seeded stream is drawn again.
- To apply the no-repeat rule consistently, the sequence is replayed day by day from `SEQUENCE_START` and memoized. It's fast (well under a second for years of puzzles).

### FPS model
```
cpuFps   = cpu.gamingScore × game.cpuLoad
gpuFps   = gpu.rasterScore × game.gpuLoad   (× 0.6 if gpu.vramGB < game.vramGB)
ramMult  = 1.0 if ram ≥ ramRecGB, 0.85 if ram ≥ ramMinGB, else 0.5
buildFps = min(cpuFps, gpuFps) × ramMult
```
Answer = weakest CPU with `cpuFps ≥ target`, weakest GPU with `gpuFps ≥ target` (penalty applied), smallest RAM `≥ ramRecGB`. Resolution and preset are constants in `config.ts` with scale tables, so you can switch to e.g. 1440p Ultra.

### Feedback
Tiles compare tier indices: 🟩 exact, 🟨 one tier away, ⬛ further. ⬆ means too weak, ⬇ means overkill. Each guess also shows its estimated FPS (red/green vs. target) and a **VRAM** tag if the GPU took the penalty. Picker options ruled out by earlier feedback are dimmed and struck through. Colorblind mode swaps green/yellow for orange/blue, including in share text.

## Adding games and parts

All data files are `{ "_comment": ..., "items": [...] }`. Parts are sorted by score at load time, so order in the file doesn't matter.

**Add a game** to `src/data/games.json`:
```json
{"steamAppId": 1091500, "name": "Cyberpunk 2077", "releaseYear": 2020, "genre": "Action RPG",
 "cpuLoad": 0.62, "gpuLoad": 0.8, "vramGB": 7, "ramMinGB": 12, "ramRecGB": 16}
```
- `steamAppId` is the number in the store URL (`store.steampowered.com/app/<id>/`). The header image is loaded from Steam's CDN (content delivery network) by that ID, with a placeholder if it fails.
- `ramRecGB` must be above 8 and at most 32. Otherwise the RAM answer is always the weakest/strongest option and the game can never be picked. The validate script flags such "dead" games.
- Keep the pool between 60 and 100 games. It must stay larger than 30 for the no-repeat rule.

**Add a CPU/GPU** to `cpus.json` / `gpus.json`. Keep scores unique so the tier order is unambiguous.

Run `npm test && npm run validate-puzzles` after any data change. **Any data or config change reshuffles all future puzzles**, so avoid editing after launch, or treat edits as a new season.

## Tuning the coefficients

Scores are approximate and meant to be tuned:
- **CPU `gamingScore`**: roughly the average 1080p CPU-bound FPS in a reference title, Ryzen 5 1600 = 100.
- **GPU `rasterScore`**: relative 1080p High raster performance, RTX 4060 = 100.
- **Game `cpuLoad` / `gpuLoad`**: pick from a known data point. If a Ryzen 7 9800X3D (312) gets about 650 FPS CPU-bound in Counter-Strike 2, `cpuLoad ≈ 650 / 312 ≈ 2.1`. If an RTX 4060 (100) gets about 80 FPS in Cyberpunk 2077 at 1080p High, `gpuLoad ≈ 0.8`. Esports titles have high loads, heavy simulators and AAA (big-budget) games have low ones.
- **`vramGB`**: VRAM (video RAM) needed at 1080p High. Raise it to make 8 GB cards stumble.

Use `validate-puzzles` to see the effect: if one FPS target dominates or a part never appears as an answer, nudge loads or scores and re-run.
