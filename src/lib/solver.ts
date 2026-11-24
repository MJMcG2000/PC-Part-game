import { FPS_EPSILON, RESOLUTION, type Resolution } from './config';
import { cpuFps, gpuFps } from './fps';
import type { BuildIdx, Catalog, Game } from './types';

const reaches = (fps: number, target: number) => fps + FPS_EPSILON >= target;

/** Index of the weakest CPU whose cpuFps reaches the target, or -1. */
export function solveCpu(game: Game, target: number, catalog: Catalog): number {
  return catalog.cpus.findIndex((c) => reaches(cpuFps(c, game), target));
}

/** Index of the weakest GPU whose gpuFps (VRAM penalty applied) reaches the target, or -1. */
export function solveGpu(game: Game, target: number, catalog: Catalog, res: Resolution = RESOLUTION): number {
  return catalog.gpus.findIndex((g) => reaches(gpuFps(g, game, res), target));
}

/** Index of the smallest RAM option >= the game's recommended RAM, or -1. */
export function solveRam(game: Game, catalog: Catalog): number {
  return catalog.ram.findIndex((r) => r.sizeGB >= game.ramRecGB);
}

/** The minimum build that reaches the target, or null if it can't be reached. */
export function solve(game: Game, target: number, catalog: Catalog, res: Resolution = RESOLUTION): BuildIdx | null {
  const cpu = solveCpu(game, target, catalog);
  const gpu = solveGpu(game, target, catalog, res);
  const ram = solveRam(game, catalog);
  if (cpu < 0 || gpu < 0 || ram < 0) return null;
  return { cpu, gpu, ram };
}
