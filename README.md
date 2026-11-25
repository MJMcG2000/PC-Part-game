# Rigdle

A daily "-dle" puzzle about building a gaming PC (personal computer). Each day you get one game, a target FPS (frames per second) and a resolution (1080p, 1440p or 4K, always High settings). In 6 guesses (8 in Hard mode), pick the **minimum** CPU (central processing unit), GPU (graphics processing unit) and RAM (random access memory) that reach the target. Overkill counts as wrong.

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

The build is a static multi-page site (`index.html` game, plus `about.html` and `privacy.html`) with relative asset paths (`base: './'`), so the same `dist/` works at a domain root or under a sub-path.

### Cloudflare Pages (primary)

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Build settings:
   - **Framework preset:** None (or Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 or newer. The repo has an `.nvmrc` (22), which Cloudflare picks up; you can also set the environment variable `NODE_VERSION=22`.
3. **Environment variables** (Settings → Variables and secrets, for Production): `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT` once you have them (see AdSense below). They're baked in at build time, so **redeploy** after changing them.
4. **Custom domain:** in the Pages project go to **Custom domains → Set up a custom domain**, enter your domain (e.g. `rigdle.com`), and follow the prompts. If the domain's DNS is on Cloudflare the record is added for you; otherwise add the CNAME record Cloudflare shows at your DNS provider. Add `www` too if you want it, and redirect one to the other.
5. Every push to `main` then builds and deploys automatically, and pull requests get preview URLs.

### GitHub Pages (secondary)

In the repository go to *Settings → Pages → Source* and choose **GitHub Actions**. Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, validates puzzles, builds and publishes `dist/` to `https://<user>.github.io/<repo>/`. That build has no AdSense variables, so it never shows ads. Once Cloudflare Pages is live, you can disable this workflow (Actions → Deploy to GitHub Pages → ⋯ → Disable workflow) so there's only one public copy of the site.

## Launch checklist (custom domain + AdSense)

Replace these placeholders before applying to AdSense:

- [ ] `public/robots.txt`, `public/sitemap.xml`, and the Open Graph / Twitter tags in `index.html`: replace `https://YOURDOMAIN.com` with your domain.
- [ ] Add `public/og-image.png` (1200×630) for link previews; `index.html` already points to it.
- [ ] `about.html` and `privacy.html`: replace `[YOUR NAME]` and `[CONTACT EMAIL]`.
- [ ] `public/ads.txt`: replace `pub-0000000000000000` with **your** publisher ID. It's the number from your `ca-pub-…` ID, written as `pub-…` (no `ca-`). The rest of the line stays the same. It must be served at `https://yourdomain.com/ads.txt`.
- [ ] Set `VITE_ADSENSE_CLIENT` (and, after creating an ad unit, `VITE_ADSENSE_SLOT`) in Cloudflare Pages and redeploy.
- [ ] Submit `https://yourdomain.com/sitemap.xml` in Google Search Console.

### AdSense

- **One config spot:** `VITE_ADSENSE_CLIENT` holds your publisher ID (`ca-pub-` + 16 digits); see `.env.example`. For local testing, copy it to `.env` (git-ignored).
- **Inactive by default:** while the variable is unset or malformed, no AdSense script is added to the page and `<AdSlot>` renders nothing. With a valid ID, the loader script is injected into `index.html` at build time (the game page only, not About/Privacy). An invalid value is ignored with a build warning.
- **The ad unit:** create a display ad unit in AdSense (Ads → By ad unit) and put its numeric ID in `VITE_ADSENSE_SLOT`. `src/components/AdSlot.tsx` renders it once, labeled "Advertisement", in a fixed 250px-high box (so the layout doesn't jump), below the game and above the footer. Keep ads out of the board, the part pickers and the modals, and away from buttons, per AdSense's accidental-click policy.
- **Consent (EEA, UK, Switzerland):** don't build a custom cookie banner. In AdSense, go to **Privacy & messaging → European regulations**, create a message for your site, and publish it. Google then shows its own certified consent message to visitors from the European Economic Area, the UK and Switzerland before serving personalized ads.

## Project layout

```
index.html         the game (React app)
about.html         crawlable About page
accuracy.html      crawlable FPS-model accuracy study (published results)
privacy.html       crawlable Privacy policy
public/            favicon, ads.txt, robots.txt, sitemap.xml (copied as-is)
.env.example       AdSense configuration template
src/
  data/            games.json (101 PC games, incl. Minecraft), console-games.json (console top-15s + all Switch/Wii Pokémon),
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
  lib/adsense.ts   AdSense ID validation + loader tag (shared with vite.config.ts)
  components/      React UI (AdSlot.tsx = the single ad unit)
scripts/validate-puzzles.ts
```

## How it works

### Daily puzzle
- Puzzle number = days since `LAUNCH_DATE` + 1 (`2026-12-01` is #1). Earlier dates show as "Preview".
- A PRNG is seeded with a hash of the local date string `YYYY-MM-DD`. It picks a game, a target from `[30, 60, 90, 120, 144, 165, 240]`, and a resolution from `1080p`, `1440p`, `4K` (`RESOLUTIONS` in `config.ts`).
- If the candidate is invalid (target unreachable, or the CPU or GPU answer is the weakest or strongest option; any RAM size from 8 to 64 GB can be the answer) or the game appeared in the previous 30 days, the same seeded stream is drawn again.
- To apply the no-repeat rule consistently, the sequence is replayed day by day from `SEQUENCE_START` and memoized. It's fast (well under a second for years of puzzles).

### Console games
`console-games.json` holds the top 15 games (by sales/popularity) for each console generation (PS2/Xbox, PS3/Xbox 360, PS4/Xbox One, PS5/Xbox Series X|S, Nintendo Switch and Nintendo Wii), plus every other Pokémon game on Switch and Wii, and the main Pokémon games on **Game Boy/GBA, DS and 3DS** (each its own Endless filter). They use the same FPS model, with coefficients estimated **as if played on a PC**:
- **Game Boy/GBA, DS, 3DS (handheld Pokémon):** via emulation. Any modern PC is far more than these need (especially Game Boy/GBA), so handheld puzzles are allowed to have the weakest CPU/GPU as the answer (the strongest is still never the answer). They're also drawn much less often: `HANDHELD_WEIGHT` (0.15) in `config.ts` keeps them to under 10% of Daily puzzles and of Endless "All"; the GB/GBA, DS and 3DS filters still serve only their games.
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
You win by naming the exact minimum build, **or** with any build whose estimated FPS is within ±10% of the target (`WIN_TOLERANCE` in `config.ts`). The exact build always wins, so every puzzle stays winnable even when no combination lands inside the 10% window.

**Hard mode** (toggle under the mode tabs) turns off the ±10% rule: only the true minimum build wins, and you get 8 guesses instead of 6 (`HARD_MAX_GUESSES`). It can only be changed before the first guess on a puzzle, is remembered per puzzle, and adds a `*` to the shared score, out of 8 (`Rigdle #42 3/8*`).

**Give up** (under Submit) ends the puzzle as a loss and reveals the answer, in both modes.

### Either brand counts
Each brand has its own minimum part: the weakest AMD **and** the weakest Intel CPU that reach the target are both correct, and likewise the weakest NVIDIA and AMD GPU (`solveByBrand` / `acceptedAnswers`). Tiles compare a guess with the minimum of **its own brand**, by position in that brand's performance-sorted list. If no part of a brand can reach the target, guesses of that brand are gray ⬆. Hard mode accepts either brand's exact minimum; normal mode also accepts anything within ±10%. Puzzle selection and validity still use the overall minimum (`puzzle.answer`), so daily puzzles didn't change.

### Layout and themes
- **Top bar:** ☰ menu and ☀️/🌙 theme toggle on the left; 👁 colorblind, statistics and **?** (how to play) on the right. Content pages have ☰ + theme on the left and "Play ▸" on the right.
- **Desktop (960px and wider, `useIsDesktop`):** three columns, with game card + target | PC diagram | part pickers or result. The PC diagram scales with the window height, so at 100% zoom the game, the diagram and the guess controls are all visible without scrolling on common screens (checked from 1280×720 to 1920×1080). Phones keep the single-column layout.
- **Light mode:** dark is the default. The theme toggle saves `rigdle:theme` in localStorage, and a tiny inline script in each page's `<head>` applies a saved light theme before first paint (no dark flash). Colors are CSS variables in `styles.css` (`:root` for dark, `:root[data-theme='light']` for light, plus colorblind overrides for each).

### Site menu and tips
The ☰ button (top right, on the game and on every content page) lists everything the site offers: Daily, Endless, How to play, Statistics, About, FPS accuracy, Privacy, and **🍺 Buy me a beer**. The game's menu is `src/components/SiteMenu.tsx` (pages listed in `src/lib/site.ts`); the static pages use a JavaScript-free `<details>` menu whose links jump into the game with `./#daily`, `./#endless`, `./#help`, `./#stats` and `./#tip`. Keep the two lists in sync when adding a page.

**Tips are a placeholder:** "Buy me a beer" opens a "tips aren't set up yet" message and links to no payment service. To turn it on later, set `VITE_TIP_URL` to an `https://` tip page (see `.env.example`) and redeploy; the message then shows a "Leave a tip" button.

### Accuracy study
`accuracy.html` publishes a study of the FPS model against published benchmarks (20 comparisons: hardware rankings, resolution scaling and game frame rates; median error 2.8%, 18 of 20 within ±10%). It led to these data changes: 4K GPU multiplier 0.42 → 0.38, RTX 3070 score 119 → 126, Cyberpunk 2077 gpuLoad 0.8 → 0.9, Black Myth: Wukong 0.55 → 0.5, Starfield 0.6 → 0.5. Update the page if you retune the model.

### Benchmark data
`src/data/benchmarks.json` holds real measured results, and they override the model wherever they exist:
- **GPU entry:** average FPS for a GPU at a resolution, High settings, tested with a fast CPU (GPU-limited). It replaces `gpuFps` for that game + GPU + resolution, and the VRAM penalty isn't applied on top, since a measurement already includes it.
- **CPU entry:** average FPS for a CPU tested with a fast GPU (CPU-limited). It replaces `cpuFps` for that game + CPU.
- **Calibration:** each game with measurements gets its `cpuLoad` / `gpuLoad` set to the median implied by them, so untested parts are estimated consistently with the tested ones.
- **In the game:** results show "📊 source" (linked when there's a URL) or "Estimate" next to each FPS bar, the line under the PC says "· benchmark" or "· estimate", and the game card shows how many results a game uses.

The file ships **empty**: every number is a model estimate until you add measurements you can cite. Add them from a spreadsheet:
```bash
npm run import-benchmarks -- results.csv --dry-run   # check names and values first
npm run import-benchmarks -- results.csv             # merge into benchmarks.json
```
Columns (see `scripts/benchmarks-template.csv`): `game, kind (cpu|gpu), part, resolution (gpu rows), fps, source, url, tested (YYYY-MM)`. Names must match the data files; the importer suggests close matches and refuses to write anything if a row is invalid. Rows replace earlier entries for the same game + part (+ resolution). `validate-puzzles` reports coverage and fails on invalid entries. **Adding or changing benchmark data reshuffles future puzzles**, like any data change, so do it before launch or treat it as a new season.

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
Tiles compare positions in the performance-sorted part lists: 🟩 exact, 🟨 one tier away, ⬛ further. ⬆ means too weak, ⬇ means overkill. There is no guess grid: the PC diagram shows the latest guess for each part (green parts stay locked), and a line under it shows the latest build's estimated FPS (red/green vs. target) with a **VRAM** tag if the GPU took the penalty. Parts already guessed are crossed out in the pickers. Each part picker starts with a brand switch: **AMD / Intel** for the CPU (AMD covers Ryzen, FX, Phenom and Athlon) and **NVIDIA / AMD** for the GPU (AMD includes older ATI Radeon cards; Intel Arc cards were removed to keep it simple). Hardware goes back to 2000 (Pentium III, Athlon, GeForce2, Radeon 8500); scores for 2000–2016 parts are extrapolated from period reviews and are rougher than for modern parts. Lists are sorted by launch date (month and year, newest first, then A–Z), so the list order gives away nothing about performance. Launch months live in `cpus.json` / `gpus.json` as `month` (1–12).

**RAM:** sizes run from 512 MB to 64 GB. Each CPU has a `memory` field for its platform: SDR (2000), DDR (2002–2005), DDR2 (2006–2009), DDR3 (2009–2014), DDR4 (Skylake through Ryzen 5000 / Intel 11th gen), DDR5 (Ryzen 7000/9000, Core Ultra; assumed for Intel 12th–14th gen, whose boards exist with either). The RAM picker, PC diagram and answer show the type that matches the CPU (e.g. "16 GB DDR5"). It's a label only: you still just pick a capacity, and the FPS model is unchanged. Colorblind mode swaps green/yellow for orange/blue, including in share text.

## Adding games and parts

All data files are `{ "_comment": ..., "items": [...] }`. Parts are sorted by score at load time, so order in the file doesn't matter.

**Add a game** to `src/data/games.json` (PC) or `src/data/console-games.json` (console; add `"platform": "switch"` etc. and an optional `steamAppId`):
```json
{"steamAppId": 1091500, "name": "Cyberpunk 2077", "releaseYear": 2020, "genre": "Action RPG",
 "cpuLoad": 0.62, "gpuLoad": 0.8, "vramGB": 7, "ramMinGB": 12, "ramRecGB": 16}
```
- `steamAppId` is the number in the store URL (`store.steampowered.com/app/<id>/`). The header image is loaded from Steam's CDN (content delivery network) by that ID, with a placeholder if it fails.
- `ramRecGB` can be anything up to 64 GB (the largest RAM option). The answer is the smallest RAM option at or above it, so 8 means an 8 GB answer and anything above 32 means 64 GB. The validate script flags "dead" games that can never produce a valid puzzle.
- `games.json` started at 100 Steam games; Minecraft: Java Edition (not on Steam, so it has no `steamAppId` and uses Wikipedia art) makes 101. `validate-puzzles` also checks every platform has at least 10 playable games for Endless.

**Add a CPU/GPU** to `cpus.json` / `gpus.json`. Keep scores unique so the tier order is unambiguous.

Run `npm test && npm run validate-puzzles` after any data change. **Any data or config change reshuffles all future puzzles**, so avoid editing after launch, or treat edits as a new season.

## Tuning the coefficients

Scores are approximate and meant to be tuned:
- **CPU `gamingScore`**: roughly the average 1080p CPU-bound FPS in a reference title, Ryzen 5 1600 = 100.
- **GPU `rasterScore`**: relative 1080p High raster performance, RTX 4060 = 100.
- **Game `cpuLoad` / `gpuLoad`**: pick from a known data point. If a Ryzen 7 9800X3D (312) gets about 650 FPS CPU-bound in Counter-Strike 2, `cpuLoad ≈ 650 / 312 ≈ 2.1`. If an RTX 4060 (100) gets about 80 FPS in Cyberpunk 2077 at 1080p High, `gpuLoad ≈ 0.8`. Esports titles have high loads, heavy simulators and AAA (big-budget) games have low ones.
- **`vramGB`**: VRAM (video RAM) needed at 1080p High. Raise it to make 8 GB cards stumble.

Use `validate-puzzles` to see the effect: if one FPS target dominates or a part never appears as an answer, nudge loads or scores and re-run.
