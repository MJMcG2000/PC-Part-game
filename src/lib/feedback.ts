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
 * Brand-aware tile: green if the guess is its brand's minimum part; otherwise
 * yellow/gray by distance to that minimum within the same brand's
 * performance-sorted list. If no part of the guessed brand reaches the target,
 * the guess is gray and too weak.
 */
export function brandTile(
  part: PartKey,
  guess: number,
  parts: { brand: string }[],
  answers: Record<string, number | null>,
): Tile {
  const brand = parts[guess].brand;
  const ans = answers[brand];
  if (ans === null || ans === undefined) return { part, color: 'gray', direction: 'up' };
  const same: number[] = [];
  parts.forEach((p, i) => p.brand === brand && same.push(i));
  return tileFor(part, same.indexOf(guess), same.indexOf(ans));
}

/** Tiles for a full guess when either brand's minimum CPU/GPU counts as correct. */
export function evaluateBuild(
  guess: BuildIdx,
  answers: { cpu: Record<string, number | null>; gpu: Record<string, number | null>; ram: number },
  parts: { cpus: { brand: string }[]; gpus: { brand: string }[] },
): Tile[] {
  return [
    brandTile('cpu', guess.cpu, parts.cpus, answers.cpu),
    brandTile('gpu', guess.gpu, parts.gpus, answers.gpu),
    tileFor('ram', guess.ram, answers.ram),
  ];
}
