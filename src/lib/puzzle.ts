import { FPS_TARGETS, MAX_REROLLS, NO_REPEAT_DAYS, SEQUENCE_START } from './config';
import { catalog as defaultCatalog } from './data';
import { addDays, daysBetween, puzzleNumber } from './date';
import { hashString, mulberry32, randInt } from './rng';
import { solve } from './solver';
import type { BuildIdx, Catalog, Game } from './types';

export interface Puzzle {
  dateKey: string;
  number: number;
  game: Game;
  targetFps: number;
  /** Answer as tier indices. Never render this before the game is over. */
  answer: BuildIdx;
  /** How many candidates were rejected before this one was accepted. */
  rerolls: number;
}

export type Validity =
  | { valid: true; answer: BuildIdx }
  | { valid: false; reason: 'unreachable' | 'cpu-extreme' | 'gpu-extreme' | 'ram-extreme' };

/**
 * A puzzle is valid when the target is reachable and no part's answer is the
 * weakest or the strongest option in its list (those are too easy to guess).
 */
export function checkPuzzle(game: Game, target: number, catalog: Catalog = defaultCatalog): Validity {
  const answer = solve(game, target, catalog);
  if (!answer) return { valid: false, reason: 'unreachable' };
  const extreme = (i: number, len: number) => i === 0 || i === len - 1;
  if (extreme(answer.cpu, catalog.cpus.length)) return { valid: false, reason: 'cpu-extreme' };
  if (extreme(answer.gpu, catalog.gpus.length)) return { valid: false, reason: 'gpu-extreme' };
  if (extreme(answer.ram, catalog.ram.length)) return { valid: false, reason: 'ram-extreme' };
  return { valid: true, answer };
}

/**
 * Generate the puzzle for one date given the app IDs used recently.
 * Seeded by a hash of the date string; invalid candidates (or recent games)
 * are rerolled by drawing again from the same seeded stream.
 */
export function generatePuzzle(
  dateKey: string,
  recentAppIds: ReadonlySet<number> = new Set(),
  catalog: Catalog = defaultCatalog,
): Puzzle {
  const rng = mulberry32(hashString(dateKey));
  const { games } = catalog;
  const make = (game: Game, targetFps: number, answer: BuildIdx, rerolls: number): Puzzle => ({
    dateKey,
    number: puzzleNumber(dateKey),
    game,
    targetFps,
    answer,
    rerolls,
  });

  for (let attempt = 0; attempt < MAX_REROLLS; attempt++) {
    const game = games[randInt(rng, games.length)];
    const target = FPS_TARGETS[randInt(rng, FPS_TARGETS.length)];
    if (recentAppIds.has(game.steamAppId)) continue;
    const v = checkPuzzle(game, target, catalog);
    if (v.valid) return make(game, target, v.answer, attempt);
  }

  // Extremely unlikely fallback: deterministic scan from a seeded offset,
  // first honoring the no-repeat rule, then relaxing it.
  const offset = randInt(rng, games.length * FPS_TARGETS.length);
  for (const honorRecent of [true, false]) {
    for (let k = 0; k < games.length * FPS_TARGETS.length; k++) {
      const n = (offset + k) % (games.length * FPS_TARGETS.length);
      const game = games[Math.floor(n / FPS_TARGETS.length)];
      const target = FPS_TARGETS[n % FPS_TARGETS.length];
      if (honorRecent && recentAppIds.has(game.steamAppId)) continue;
      const v = checkPuzzle(game, target, catalog);
      if (v.valid) return make(game, target, v.answer, MAX_REROLLS + k);
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
    const recent = new Set<number>();
    for (let i = 1; i <= NO_REPEAT_DAYS; i++) {
      const prev = addDays(day, -i);
      if (daysBetween(SEQUENCE_START, prev) < 0) break;
      const p = cache.get(prev);
      if (p) recent.add(p.game.steamAppId);
    }
    cache.set(day, generatePuzzle(day, recent, catalog));
  }
  return cache.get(dateKey)!;
}
