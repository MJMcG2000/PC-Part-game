import {
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
} from './config';
import type { Cpu, Game, Gpu } from './types';

export function cpuFps(cpu: Cpu, game: Game): number {
  return cpu.gamingScore * game.cpuLoad * PRESET_CPU_SCALE[PRESET];
}

export function requiredVramGB(game: Game): number {
  return game.vramGB * RESOLUTION_VRAM_SCALE[RESOLUTION];
}

export function hasVramPenalty(gpu: Gpu, game: Game): boolean {
  return gpu.vramGB < requiredVramGB(game);
}

export function gpuFps(gpu: Gpu, game: Game): number {
  const base = gpu.rasterScore * game.gpuLoad * RESOLUTION_GPU_SCALE[RESOLUTION] * PRESET_GPU_SCALE[PRESET];
  return hasVramPenalty(gpu, game) ? base * VRAM_PENALTY : base;
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
}

export function buildFps(cpu: Cpu, gpu: Gpu, ramGB: number, game: Game): FpsBreakdown {
  const c = cpuFps(cpu, game);
  const g = gpuFps(gpu, game);
  const m = ramMultiplier(ramGB, game);
  return {
    cpuFps: c,
    gpuFps: g,
    ramMultiplier: m,
    vramPenalty: hasVramPenalty(gpu, game),
    fps: Math.min(c, g) * m,
    limitedBy: c <= g ? 'cpu' : 'gpu',
  };
}

/** Display helper: floor with a tiny epsilon so 59.9999999 shows as 60. */
export function displayFps(fps: number): number {
  return Math.floor(fps + 1e-6);
}
