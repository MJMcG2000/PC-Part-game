import { catalog as defaultCatalog } from './data';
import { evaluateBuild, type GpuCheck, type Tile } from './feedback';
import { gpuFps, hasVramPenalty } from './fps';
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

/** GPU check for a puzzle's tiles: does the card miss the target, and is it short on VRAM? */
export function gpuChecker(puzzle: Puzzle, catalog: Catalog = defaultCatalog): (gpu: number) => GpuCheck {
  return (i) => {
    const g = catalog.gpus[i];
    return {
      misses: gpuFps(g, puzzle.game, puzzle.resolution) + FPS_EPSILON < puzzle.targetFps,
      vramShort: hasVramPenalty(g, puzzle.game, puzzle.resolution),
    };
  };
}

export function tileRowsFor(puzzle: Puzzle, guesses: StoredGuess[]): Tile[][] {
  const accepted = acceptedAnswers(puzzle);
  return guessIndices(guesses).map((g) => evaluateBuild(g, accepted, defaultCatalog, gpuChecker(puzzle)));
}
