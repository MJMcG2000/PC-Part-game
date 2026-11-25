import { catalog as defaultCatalog } from './data';
import { evaluateBuild, type PartCheck, type Tile } from './feedback';
import { cpuFps, gpuFps, hasVramPenalty, isCloseEnough } from './fps';
import { FPS_EPSILON } from './config';
import { acceptedAnswers, type Puzzle } from './puzzle';
import type { StoredGuess } from './storage';
import type { BuildIdx, Catalog } from './types';

/** Map stored (name-based) guesses back to tier indices; drop any that no longer resolve. */
export function toIdx(g: StoredGuess, catalog: Catalog = defaultCatalog): BuildIdx | null {
  const cpu = catalog.cpus.findIndex((c) => c.name === g.cpu);
  const gpu = catalog.gpus.findIndex((c) => c.name === g.gpu);
  const ram = catalog.ram.findIndex((r) => r.sizeGB === g.ramGB);
  return cpu < 0 || gpu < 0 || ram < 0 ? null : { cpu, gpu, ram };
}

export function guessIndices(guesses: StoredGuess[]): BuildIdx[] {
  return guesses.map((g) => toIdx(g)).filter((g): g is BuildIdx => g !== null);
}

/**
 * Per-part checks for a puzzle's tiles. A CPU or GPU whose own FPS is within
 * the win tolerance of the target counts as green in normal mode (not in Hard
 * mode, which wants the exact minimum part). GPUs also report a VRAM shortfall.
 */
export function partChecks(puzzle: Puzzle, hard = false, catalog: Catalog = defaultCatalog) {
  const t = puzzle.targetFps;
  const close = (fps: number) => !hard && isCloseEnough(fps, t);
  return {
    cpu: (i: number): PartCheck => {
      const fps = cpuFps(catalog.cpus[i], puzzle.game);
      return { misses: fps + FPS_EPSILON < t, close: close(fps) };
    },
    gpu: (i: number): PartCheck => {
      const g = catalog.gpus[i];
      const fps = gpuFps(g, puzzle.game, puzzle.resolution);
      return { misses: fps + FPS_EPSILON < t, vramShort: hasVramPenalty(g, puzzle.game, puzzle.resolution), close: close(fps) };
    },
  };
}

/** GPU check only (kept for callers that don't need the CPU). */
export const gpuChecker = (puzzle: Puzzle, hard = false) => partChecks(puzzle, hard).gpu;

export function tileRowsFor(puzzle: Puzzle, guesses: StoredGuess[], hard = false): Tile[][] {
  const accepted = acceptedAnswers(puzzle);
  return guessIndices(guesses).map((g) => evaluateBuild(g, accepted, defaultCatalog, partChecks(puzzle, hard)));
}
