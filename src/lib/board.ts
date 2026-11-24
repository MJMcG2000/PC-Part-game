import { catalog as defaultCatalog } from './data';
import { evaluateGuess, type Tile } from './feedback';
import type { Puzzle } from './puzzle';
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

export function tileRowsFor(puzzle: Puzzle, guesses: StoredGuess[]): Tile[][] {
  return guessIndices(guesses).map((g) => evaluateGuess(g, puzzle.answer));
}
