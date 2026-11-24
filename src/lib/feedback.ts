import type { BuildIdx, PartKey } from './types';
import { PART_KEYS } from './types';

export type TileColor = 'green' | 'yellow' | 'gray';
/** 'up' = guess is too weak (go stronger); 'down' = overkill (go weaker). */
export type Direction = 'up' | 'down' | null;

export interface Tile {
  part: PartKey;
  color: TileColor;
  direction: Direction;
}

export function tileFor(part: PartKey, guess: number, answer: number): Tile {
  const diff = answer - guess;
  if (diff === 0) return { part, color: 'green', direction: null };
  return {
    part,
    color: Math.abs(diff) === 1 ? 'yellow' : 'gray',
    direction: diff > 0 ? 'up' : 'down',
  };
}

export function evaluateGuess(guess: BuildIdx, answer: BuildIdx): Tile[] {
  return PART_KEYS.map((k) => tileFor(k, guess[k], answer[k]));
}

export const isWin = (tiles: Tile[]) => tiles.every((t) => t.color === 'green');

const EMOJI: Record<TileColor, [normal: string, colorblind: string]> = {
  green: ['🟩', '🟧'],
  yellow: ['🟨', '🟦'],
  gray: ['⬛', '⬛'],
};

export function tileEmoji(color: TileColor, colorblind = false): string {
  return EMOJI[color][colorblind ? 1 : 0];
}

export const arrowFor = (d: Direction) => (d === 'up' ? '⬆' : d === 'down' ? '⬇' : '');

/**
 * Inclusive [min, max] tier range still possible for a part, given past
 * guesses for that part and their tiles. Used to dim ruled-out options.
 */
export function possibleRange(
  history: { guess: number; tile: Tile }[],
  optionCount: number,
): [min: number, max: number] {
  let lo = 0;
  let hi = optionCount - 1;
  for (const { guess, tile } of history) {
    if (tile.color === 'green') return [guess, guess];
    const step = tile.color === 'yellow' ? 1 : 2;
    if (tile.direction === 'up') {
      lo = Math.max(lo, guess + step);
      if (tile.color === 'yellow') hi = Math.min(hi, guess + 1);
    } else {
      hi = Math.min(hi, guess - step);
      if (tile.color === 'yellow') lo = Math.max(lo, guess - 1);
    }
  }
  return [lo, hi];
}
