# Rigdle

A daily "-dle" puzzle about building a gaming PC (personal computer). Each day you get one game, a target FPS (frames per second) and a resolution (1080p, 1440p or 4K, always High settings). In 6 guesses, pick the **minimum** CPU (central processing unit), GPU (graphics processing unit) and RAM (random access memory) that reach the target. Overkill counts as wrong.

Two modes:
- **Daily:** one rig per day, the same for everyone, resets at local midnight.
- **Endless:** keep building rigs back to back, optionally filtered by platform (PC, PS2/Xbox, PS3/360, PS4/One, PS5/Series, Switch, Wii). Endless has its own stats and streak. **↻ New rig** skips the current puzzle: free before the first guess, counted as a loss after it.

A PC tower diagram (side view, glass panel) shows your latest guess for each part in the slot where it sits on the motherboard, and locks a part in green once you find it.

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
  data/            games.json (100 PC/Steam games), console-games.json (console top-15s),
                   cpus.json, gpus.json, ram.json  (all editable)
  lib/
    config.ts      all tunables: launch date, FPS targets, resolution/preset, penalties
    rng.ts         string hash + mulberry32 PRNG (pseudo-random number generator)
    date.ts        local date keys, puzzle numbers, countdown
    data.ts        loads JSON, assigns game ids/platforms, sorts parts weakest -> strongest
    platforms.ts   platform list, Endless filter, cross-platform repeat key
    fps.ts         the FPS model
    solver.ts      minimum-build solver
    puzzle.ts      daily + Endless generation, validity + reroll rules, 30-day no-repeat
    feedback.ts    tiles (green/yellow/gray + arrows)
    share.ts       share text
    storage.ts     localStorage state + stats
    validate.ts    sequence analysis used by the script and tests
  components/      React UI
scripts/validate-puzzles.ts
```

## How it works

### Daily puzzle
- Puzzle number = days since `LAUNCH_DATE` + 1 (`2026-12-01` is #1). Earlier dates show as "Preview".
- A PRNG is seeded with a hash of the local date string `YYYY-MM-DD`. It picks a game, a target from `[30, 60, 90, 120, 144, 165, 240]`, and a resolution from `1080p`, `1440p`, `4K` (`RESOLUTIONS` in `config.ts`).
- If the candidate is invalid (target unreachable, or the CPU or GPU answer is the weakest or strongest option; any RAM size from 8 to 64 GB can be the answer) or the game appeared in the previous 30 days, the same seeded stream is drawn again.
- To apply the no-repeat rule consistently, the sequence is replayed day by day from `SEQUENCE_START` and memoized. It's fast (well under a second for years of puzzles).

### Console games
`console-games.json` holds the top 15 games (by sales/popularity) for each console generation: PS2/Xbox, PS3/Xbox 360, PS4/Xbox One, PS5/Xbox Series X|S, Nintendo Switch and Nintendo Wii. They use the same FPS model, with coefficients estimated **as if played on a PC**:
- **PS2/Xbox, PS3/360, Switch, Wii:** via emulation, upscaled to 1080p with frame rate unlocked. Emulation is CPU-heavy, so these puzzles lean on the CPU (PS3/360 especially). Running the original PC ports of these old games would hit hundreds of FPS on any part, which would make every puzzle trivial.
- **PS4/One, PS5/Series:** via the game's PC port, or an estimated hypothetical port for exclusives such as Bloodborne or Astro Bot.

Console top-15 games that are already in `games.json` (Elden Ring, God of War, Red Dead Redemption 2, and others) are tagged there with `"alsoOn": ["ps5-xsx"]` instead of being duplicated. The Daily puzzle draws from all games, PC and console. The no-repeat rule treats the same title on two platforms (e.g. GTA V on PC and on PS3/360) as one game. Console games use Steam art when the same game is on Steam (`steamAppId`). Otherwise the player's browser loads the cover art from English Wikipedia: first the article named by `wikiTitle`, then a Wikipedia search, then a platform-styled placeholder. Lookups are cached in `localStorage`.

### FPS model
```
cpuFps   = cpu.gamingScore × game.cpuLoad
gpuFps   = gpu.rasterScore × game.gpuLoad   (× 0.6 if gpu.vramGB < game.vramGB)
ramMult  = 1.0 if ram ≥ ramRecGB, 0.85 if ram ≥ ramMinGB, else 0.5
buildFps = min(cpuFps, gpuFps) × ramMult
```
Answer = weakest CPU with `cpuFps ≥ target`, weakest GPU with `gpuFps ≥ target` (penalty applied), smallest RAM `≥ ramRecGB`.

Resolution only affects the GPU side, through two tables in `config.ts`:

| Resolution | GPU FPS multiplier | VRAM needed |
|---|---|---|
| 1080p | × 1.00 | game.vramGB × 1.0 |
| 1440p | × 0.72 | game.vramGB × 1.2 |
| 4K | × 0.42 | game.vramGB × 1.5 |

The graphics preset is fixed at High (`PRESET`), with its own scale tables if you want to change it.

### Winning
You win by naming the exact minimum build, **or** with any build whose estimated FPS is within ±5% of the target (`WIN_TOLERANCE` in `config.ts`). The exact build always wins, so every puzzle stays winnable even when no combination lands inside the 5% window.

**Hard mode** (toggle under the mode tabs) turns off the ±5% rule: only the true minimum build wins. It can only be changed before the first guess on a puzzle, is remembered per puzzle, and adds a `*` to the shared score (`Rigdle #42 3/6*`).

**Give up** (under Submit) ends the puzzle as a loss and reveals the answer, in both modes.

### Sharing
**Share result** copies text like this to the clipboard (one row per guess, columns CPU | GPU | RAM):
```
Rigdle #42 3/6
🎮 Cyberpunk 2077
🎯 144 FPS @ 1080p High
CPU | GPU | RAM
🟨 | ⬛ | 🟩
🟩 | 🟨 | 🟩
🟩 | 🟩 | 🟩
```
It names the game, so a shared Daily result tells others which game today's puzzle is.

### Feedback
Tiles compare positions in the performance-sorted part lists: 🟩 exact, 🟨 one tier away, ⬛ further. ⬆ means too weak, ⬇ means overkill. There is no guess grid: the PC diagram shows the latest guess for each part (green parts stay locked), and a line under it shows the latest build's estimated FPS (red/green vs. target) with a **VRAM** tag if the GPU took the penalty. Parts already guessed are crossed out in the pickers. CPUs and GPUs are listed by release year (newest first, then A–Z), so the list order gives away nothing about performance. Colorblind mode swaps green/yellow for orange/blue, including in share text.

## Adding games and parts

All data files are `{ "_comment": ..., "items": [...] }`. Parts are sorted by score at load time, so order in the file doesn't matter.

**Add a game** to `src/data/games.json` (PC) or `src/data/console-games.json` (console; add `"platform": "switch"` etc. and an optional `steamAppId`):
```json
{"steamAppId": 1091500, "name": "Cyberpunk 2077", "releaseYear": 2020, "genre": "Action RPG",
 "cpuLoad": 0.62, "gpuLoad": 0.8, "vramGB": 7, "ramMinGB": 12, "ramRecGB": 16}
```
- `steamAppId` is the number in the store URL (`store.steampowered.com/app/<id>/`). The header image is loaded from Steam's CDN (content delivery network) by that ID, with a placeholder if it fails.
- `ramRecGB` can be anything up to 64 GB (the largest RAM option). The answer is the smallest RAM option at or above it, so 8 means an 8 GB answer and anything above 32 means 64 GB. The validate script flags "dead" games that can never produce a valid puzzle.
- Keep `games.json` between 60 and 100 games. `validate-puzzles` also checks every platform has at least 10 playable games for Endless.

**Add a CPU/GPU** to `cpus.json` / `gpus.json`. Keep scores unique so the tier order is unambiguous.

Run `npm test && npm run validate-puzzles` after any data change. **Any data or config change reshuffles all future puzzles**, so avoid editing after launch, or treat edits as a new season.

## Tuning the coefficients

Scores are approximate and meant to be tuned:
- **CPU `gamingScore`**: roughly the average 1080p CPU-bound FPS in a reference title, Ryzen 5 1600 = 100.
- **GPU `rasterScore`**: relative 1080p High raster performance, RTX 4060 = 100.
- **Game `cpuLoad` / `gpuLoad`**: pick from a known data point. If a Ryzen 7 9800X3D (312) gets about 650 FPS CPU-bound in Counter-Strike 2, `cpuLoad ≈ 650 / 312 ≈ 2.1`. If an RTX 4060 (100) gets about 80 FPS in Cyberpunk 2077 at 1080p High, `gpuLoad ≈ 0.8`. Esports titles have high loads, heavy simulators and AAA (big-budget) games have low ones.
- **`vramGB`**: VRAM (video RAM) needed at 1080p High. Raise it to make 8 GB cards stumble.

Use `validate-puzzles` to see the effect: if one FPS target dominates or a part never appears as an answer, nudge loads or scores and re-run.
