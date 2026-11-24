import {
  WIN_TOLERANCE,
  PRESET,
  PRESET_CPU_SCALE,
  PRESET_GPU_SCALE,
  RAM_MULT_BELOW,
  RAM_MULT_MIN,
  RAM_MULT_REC,
  RESOLUTION,
  RESOLUTION_GPU_SCALE,
  RESOLUTION_VRAM_SCALE,
  VRAM_PENALTY,
  type Resolution,
} from './config';
import type { Cpu, Game, Gpu } from './types';
import { gpuBenchKey, type BenchmarkEntry } from './benchmarks';

/** Measured CPU-limited result for this CPU and game, if any. */
export const cpuBenchmark = (cpu: Cpu, game: Game): BenchmarkEntry | undefined => game.benchmarks?.cpu.get(cpu.name);

/** Measured GPU-limited result for this GPU, game and resolution, if any. */
export const gpuBenchmark = (gpu: Gpu, game: Game, res: Resolution = RESOLUTION): BenchmarkEntry | undefined =>
  game.benchmarks?.gpu.get(gpuBenchKey(gpu.name, res));

/** CPU-limited FPS: a benchmark when available, otherwise the model estimate. */
export function cpuFps(cpu: Cpu, game: Game): number {
  const measured = cpuBenchmark(cpu, game);
  if (measured) return measured.fps;
  return cpu.gamingScore * game.cpuLoad * PRESET_CPU_SCALE[PRESET];
}

/** VRAM the game wants at this resolution (higher resolutions need more). */
export function requiredVramGB(game: Game, res: Resolution = RESOLUTION): number {
  return game.vramGB * RESOLUTION_VRAM_SCALE[res];
}

export function hasVramPenalty(gpu: Gpu, game: Game, res: Resolution = RESOLUTION): boolean {
  return gpu.vramGB < requiredVramGB(game, res);
}

/**
 * GPU-limited FPS: a benchmark when available (it already reflects any VRAM
 * shortfall), otherwise the model. Resolution only affects the GPU side.
 */
export function gpuFps(gpu: Gpu, game: Game, res: Resolution = RESOLUTION): number {
  const measured = gpuBenchmark(gpu, game, res);
  if (measured) return measured.fps;
  const base = gpu.rasterScore * game.gpuLoad * RESOLUTION_GPU_SCALE[res] * PRESET_GPU_SCALE[PRESET];
  return hasVramPenalty(gpu, game, res) ? base * VRAM_PENALTY : base;
}

export function ramMultiplier(ramGB: number, game: Game): number {
  if (ramGB >= game.ramRecGB) return RAM_MULT_REC;
  if (ramGB >= game.ramMinGB) return RAM_MULT_MIN;
  return RAM_MULT_BELOW;
}

export interface FpsBreakdown {
  cpuFps: number;
  gpuFps: number;
  ramMultiplier: number;
  vramPenalty: boolean;
  fps: number;
  limitedBy: 'cpu' | 'gpu';
  /** The measurements used, or null where the number is a model estimate. */
  cpuSource: BenchmarkEntry | null;
  gpuSource: BenchmarkEntry | null;
}

export function buildFps(cpu: Cpu, gpu: Gpu, ramGB: number, game: Game, res: Resolution = RESOLUTION): FpsBreakdown {
  const c = cpuFps(cpu, game);
  const g = gpuFps(gpu, game, res);
  const m = ramMultiplier(ramGB, game);
  return {
    cpuFps: c,
    gpuFps: g,
    ramMultiplier: m,
    vramPenalty: !gpuBenchmark(gpu, game, res) && hasVramPenalty(gpu, game, res),
    fps: Math.min(c, g) * m,
    limitedBy: c <= g ? 'cpu' : 'gpu',
    cpuSource: cpuBenchmark(cpu, game) ?? null,
    gpuSource: gpuBenchmark(gpu, game, res) ?? null,
  };
}

/** Display helper: floor with a tiny epsilon so 59.9999999 shows as 60. */
export function displayFps(fps: number): number {
  return Math.floor(fps + 1e-6);
}

/** True when fps is within ±WIN_TOLERANCE of the target (counts as a win). */
export function isCloseEnough(fps: number, target: number): boolean {
  return Math.abs(fps - target) <= target * WIN_TOLERANCE + 1e-6;
}
