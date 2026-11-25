import type { BuildIdx, PartKey } from './types';
import { PART_KEYS } from './types';

export type TileColor = 'green' | 'yellow' | 'gray';
/** 'up' = guess is too weak (go stronger); 'down' = overkill (go weaker). Yellow tiles shown to players carry no direction (see hideYellowDirection). */
export type Direction = 'up' | 'down' | null;

export interface Tile {
  part: PartKey;
  color: TileColor;
  direction: Direction;
  /** GPU only: the card has less video memory than this game needs at this resolution. */
  vramShort?: boolean;
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

/**
 * Only gray tiles tell the player which way to go. A yellow tile says "one
 * tier away" without saying up or down, so the player has to work out which
 * neighbor it is. Applied last, after the VRAM fix-up (which needs the raw direction).
 */
export const hideYellowDirection = (t: Tile): Tile => (t.color === 'yellow' && t.direction ? { ...t, direction: null } : t);

export function evaluateGuess(guess: BuildIdx, answer: BuildIdx): Tile[] {
  return PART_KEYS.map((k) => hideYellowDirection(tileFor(k, guess[k], answer[k])));
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

/** How a guessed GPU does on this puzzle (from the FPS model). */
export interface GpuCheck {
  /** Its FPS falls short of the target. */
  misses: boolean;
  /** It has less VRAM than the game needs at this resolution. */
  vramShort: boolean;
}

/**
 * VRAM fix-up for a GPU tile. Tiles follow each brand's performance ladder,
 * but a card with too little video memory can rank above the answer and still
 * miss the target (e.g. an 8 GB card when the game needs 9.6 GB). Its arrow
 * would say "go weaker", which is wrong: it is gray, points up (not enough)
 * and is flagged as short on VRAM.
 */
export function applyVram(tile: Tile, check: GpuCheck | undefined): Tile {
  if (!check || tile.color === 'green') return tile;
  if (check.misses && tile.direction === 'down') return { ...tile, color: 'gray', direction: 'up', vramShort: true };
  return check.vramShort ? { ...tile, vramShort: true } : tile;
}

/** Tiles for a full guess when either brand's minimum CPU/GPU counts as correct. */
export function evaluateBuild(
  guess: BuildIdx,
  answers: { cpu: Record<string, number | null>; gpu: Record<string, number | null>; ram: number },
  parts: { cpus: { brand: string }[]; gpus: { brand: string }[] },
  checkGpu?: (gpu: number) => GpuCheck,
): Tile[] {
  return [
    brandTile('cpu', guess.cpu, parts.cpus, answers.cpu),
    applyVram(brandTile('gpu', guess.gpu, parts.gpus, answers.gpu), checkGpu?.(guess.gpu)),
    tileFor('ram', guess.ram, answers.ram),
  ].map(hideYellowDirection);
}
