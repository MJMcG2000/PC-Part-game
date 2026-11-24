import { FPS_TARGETS, MAX_REROLLS, NO_REPEAT_DAYS, RESOLUTION, RESOLUTIONS, SEQUENCE_START, type Resolution } from './config';
import { catalog as defaultCatalog } from './data';
import { addDays, daysBetween, puzzleNumber } from './date';
import { hashString, mulberry32, randInt } from './rng';
import { matchesPlatform, repeatKey, type PlatformFilter } from './platforms';
import { solve } from './solver';
import type { BuildIdx, Catalog, Game } from './types';

export interface Puzzle {
  dateKey: string;
  number: number;
  game: Game;
  targetFps: number;
  resolution: Resolution;
  /** Answer as tier indices. Never render this before the game is over. */
  answer: BuildIdx;
  /** How many candidates were rejected before this one was accepted. */
  rerolls: number;
}

export type Validity =
  | { valid: true; answer: BuildIdx }
  | { valid: false; reason: 'unreachable' | 'cpu-extreme' | 'gpu-extreme' };

/**
 * A puzzle is valid when the target is reachable and the CPU and GPU answers
 * are not the weakest or strongest option in their lists (too easy to guess).
 * RAM has only four options, so any of them (8-64 GB) can be the answer.
 */
export function checkPuzzle(
  game: Game,
  target: number,
  catalog: Catalog = defaultCatalog,
  res: Resolution = RESOLUTION,
): Validity {
  const answer = solve(game, target, catalog, res);
  if (!answer) return { valid: false, reason: 'unreachable' };
  const extreme = (i: number, len: number) => i === 0 || i === len - 1;
  if (extreme(answer.cpu, catalog.cpus.length)) return { valid: false, reason: 'cpu-extreme' };
  if (extreme(answer.gpu, catalog.gpus.length)) return { valid: false, reason: 'gpu-extreme' };
  return { valid: true, answer };
}

/**
 * Generate the puzzle for one date given the app IDs used recently.
 * Seeded by a hash of the date string; invalid candidates (or recent games)
 * are rerolled by drawing again from the same seeded stream.
 * `recentKeys` holds repeatKey()s of recently used games.
 */
export function generatePuzzle(
  dateKey: string,
  recentKeys: ReadonlySet<string> = new Set(),
  catalog: Catalog = defaultCatalog,
): Puzzle {
  const rng = mulberry32(hashString(dateKey));
  const { games } = catalog;
  const make = (game: Game, targetFps: number, resolution: Resolution, answer: BuildIdx, rerolls: number): Puzzle => ({
    dateKey,
    number: puzzleNumber(dateKey),
    game,
    targetFps,
    resolution,
    answer,
    rerolls,
  });

  for (let attempt = 0; attempt < MAX_REROLLS; attempt++) {
    const game = games[randInt(rng, games.length)];
    const target = FPS_TARGETS[randInt(rng, FPS_TARGETS.length)];
    const res = RESOLUTIONS[randInt(rng, RESOLUTIONS.length)];
    if (recentKeys.has(repeatKey(game))) continue;
    const v = checkPuzzle(game, target, catalog, res);
    if (v.valid) return make(game, target, res, v.answer, attempt);
  }

  // Extremely unlikely fallback: deterministic scan from a seeded offset over
  // every game x target x resolution, first honoring the no-repeat rule, then relaxing it.
  const per = FPS_TARGETS.length * RESOLUTIONS.length;
  const total = games.length * per;
  const offset = randInt(rng, total);
  for (const honorRecent of [true, false]) {
    for (let k = 0; k < total; k++) {
      const n = (offset + k) % total;
      const game = games[Math.floor(n / per)];
      const target = FPS_TARGETS[Math.floor((n % per) / RESOLUTIONS.length)];
      const res = RESOLUTIONS[n % RESOLUTIONS.length];
      if (honorRecent && recentKeys.has(repeatKey(game))) continue;
      const v = checkPuzzle(game, target, catalog, res);
      if (v.valid) return make(game, target, res, v.answer, MAX_REROLLS + k);
    }
  }
  throw new Error(`No valid puzzle exists for ${dateKey}: check the data files.`);
}

const caches = new WeakMap<Catalog, Map<string, Puzzle>>();

/**
 * The puzzle for a date. The sequence is replayed day by day from
 * SEQUENCE_START so the no-repeat window is applied consistently;
 * results are memoized per catalog.
 */
export function getPuzzle(dateKey: string, catalog: Catalog = defaultCatalog): Puzzle {
  let cache = caches.get(catalog);
  if (!cache) caches.set(catalog, (cache = new Map()));
  const hit = cache.get(dateKey);
  if (hit) return hit;

  if (daysBetween(SEQUENCE_START, dateKey) < 0) {
    const p = generatePuzzle(dateKey, new Set(), catalog);
    cache.set(dateKey, p);
    return p;
  }

  // Walk forward from the latest cached day (or SEQUENCE_START).
  let day = dateKey;
  while (daysBetween(SEQUENCE_START, day) > 0 && !cache.has(addDays(day, -1))) day = addDays(day, -1);
  // `day` is now the first uncached date whose predecessor is cached (or the start).
  for (; daysBetween(day, dateKey) >= 0; day = addDays(day, 1)) {
    const recent = new Set<string>();
    for (let i = 1; i <= NO_REPEAT_DAYS; i++) {
      const prev = addDays(day, -i);
      if (daysBetween(SEQUENCE_START, prev) < 0) break;
      const p = cache.get(prev);
      if (p) recent.add(repeatKey(p.game));
    }
    cache.set(day, generatePuzzle(day, recent, catalog));
  }
  return cache.get(dateKey)!;
}

/** Catalog restricted to one platform (parts unchanged). */
export function filterCatalog(catalog: Catalog, filter: PlatformFilter): Catalog {
  return filter === 'all' ? catalog : { ...catalog, games: catalog.games.filter((g) => matchesPlatform(g, filter)) };
}

/**
 * A random Endless puzzle. `seed` should be fresh randomness; the same seed,
 * filter and recent list always give the same puzzle.
 */
export function generateEndless(
  seed: string,
  filter: PlatformFilter,
  recentKeys: string[],
  catalog: Catalog = defaultCatalog,
): Puzzle {
  const pool = filterCatalog(catalog, filter);
  // Keep the no-repeat window well below the pool size so rerolls stay cheap.
  const window = Math.max(0, Math.min(NO_REPEAT_DAYS, Math.floor(pool.games.length / 2)));
  const recent = new Set(recentKeys.slice(-window));
  return { ...generatePuzzle(`endless:${seed}`, recent, pool), number: 0 };
}

/** Rebuild a puzzle from a saved game id + target (used to restore Endless progress). */
export function puzzleFromSaved(
  gameId: string,
  targetFps: number,
  resolution: Resolution = RESOLUTION,
  catalog: Catalog = defaultCatalog,
): Puzzle | null {
  const game = catalog.games.find((g) => g.id === gameId);
  if (!game) return null;
  const v = checkPuzzle(game, targetFps, catalog, resolution);
  if (!v.valid) return null;
  return { dateKey: 'endless', number: 0, game, targetFps, resolution, answer: v.answer, rerolls: 0 };
}
