import type { BuildIdx, PartKey } from './types';
import { PART_KEYS } from './types';

export type TileColor = 'green' | 'yellow' | 'gray';
/** 'up' = guess is too weak (go stronger); 'down' = overkill (go weaker). */
export type Direction = 'up' | 'down' | null;

export interface Tile {
  part: PartKey;
  color: TileColor;
  direction: Direction;
  /** GPU only: the card has less video memory than this game needs at this resolution. */
  vramShort?: boolean;
  /** Green because the part alone lands within the win tolerance of the target, not because it's the exact minimum. */
  close?: boolean;
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

/** How a guessed CPU or GPU does on this puzzle on its own (from the FPS model). */
export interface PartCheck {
  /** Its FPS falls short of the target. */
  misses: boolean;
  /** GPU only: it has less VRAM than the game needs at this resolution. */
  vramShort?: boolean;
  /** Normal mode: its own FPS is within the win tolerance of the target, so it counts as green. */
  close?: boolean;
}
/** @deprecated use PartCheck */
export type GpuCheck = PartCheck;

/** Close enough counts as green (normal mode only; the checker leaves `close` unset in Hard mode). */
export function applyClose(tile: Tile, check: PartCheck | undefined): Tile {
  return check?.close && tile.color !== 'green' ? { part: tile.part, color: 'green', direction: null, close: true } : tile;
}

/**
 * VRAM fix-up for a GPU tile. Tiles follow each brand's performance ladder,
 * but a card with too little video memory can rank above the answer and still
 * miss the target (e.g. an 8 GB card when the game needs 9.6 GB). Its arrow
 * would say "go weaker", which is wrong: it is gray, points up (not enough)
 * and is flagged as short on VRAM.
 */
export function applyVram(tile: Tile, check: PartCheck | undefined): Tile {
  if (!check || tile.color === 'green') return tile;
  if (check.misses && tile.direction === 'down') return { ...tile, color: 'gray', direction: 'up', vramShort: true };
  return check.vramShort ? { ...tile, vramShort: true } : tile;
}

/** Tiles for a full guess when either brand's minimum CPU/GPU counts as correct. */
export function evaluateBuild(
  guess: BuildIdx,
  answers: { cpu: Record<string, number | null>; gpu: Record<string, number | null>; ram: number },
  parts: { cpus: { brand: string }[]; gpus: { brand: string }[] },
  checks?: { cpu?: (cpu: number) => PartCheck; gpu?: (gpu: number) => PartCheck },
): Tile[] {
  const cpuCheck = checks?.cpu?.(guess.cpu);
  const gpuCheck = checks?.gpu?.(guess.gpu);
  return [
    applyClose(brandTile('cpu', guess.cpu, parts.cpus, answers.cpu), cpuCheck),
    applyClose(applyVram(brandTile('gpu', guess.gpu, parts.gpus, answers.gpu), gpuCheck), gpuCheck),
    tileFor('ram', guess.ram, answers.ram),
  ];
}
