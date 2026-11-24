/**
 * Real benchmark data, used wherever it exists.
 *
 * Each entry is one measured average FPS for a game at High settings:
 * - kind "gpu": a GPU at a resolution, tested with a fast CPU (GPU-limited).
 *   It replaces the model's gpuFps for that GPU, game and resolution.
 * - kind "cpu": a CPU tested with a fast GPU (CPU-limited). It replaces the
 *   model's cpuFps for that CPU and game (CPU FPS doesn't depend on resolution).
 *
 * Every game with measurements is also calibrated: its cpuLoad / gpuLoad is
 * set to the median value implied by its measurements, so the estimates for
 * parts that weren't tested line up with the ones that were.
 */
import { PRESET, PRESET_CPU_SCALE, PRESET_GPU_SCALE, RESOLUTIONS, RESOLUTION_GPU_SCALE, RESOLUTION_VRAM_SCALE, type Resolution } from './config';
import type { Cpu, Game, Gpu } from './types';

export interface BenchmarkEntry {
  /** Game name exactly as in games.json / console-games.json. */
  game: string;
  kind: 'cpu' | 'gpu';
  /** CPU or GPU name exactly as in cpus.json / gpus.json. */
  part: string;
  /** Required for GPU entries; ignored for CPU entries. */
  resolution?: Resolution;
  /** Average FPS at High settings. */
  fps: number;
  /** Who measured it (site or channel name). */
  source: string;
  url?: string;
  /** When it was tested, YYYY-MM. */
  tested?: string;
}

export interface GameBenchmarks {
  /** By CPU name. */
  cpu: Map<string, BenchmarkEntry>;
  /** By `${gpuName}|${resolution}`. */
  gpu: Map<string, BenchmarkEntry>;
  /** How many measurements calibrated each load (0 = model estimate only). */
  calibratedFrom: { cpu: number; gpu: number };
}

export const gpuBenchKey = (gpu: string, res: Resolution) => `${gpu}|${res}`;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Problems with benchmark entries (unknown names, bad values). Empty = valid. */
export function validateBenchmarks(
  entries: BenchmarkEntry[],
  games: { name: string }[],
  cpus: { name: string }[],
  gpus: { name: string }[],
): string[] {
  const problems: string[] = [];
  const gameNames = new Set(games.map((g) => g.name));
  const cpuNames = new Set(cpus.map((c) => c.name));
  const gpuNames = new Set(gpus.map((g) => g.name));
  const seen = new Set<string>();
  entries.forEach((e, i) => {
    const where = `benchmark #${i + 1} (${e.game} / ${e.part})`;
    if (!gameNames.has(e.game)) problems.push(`${where}: unknown game "${e.game}"`);
    if (e.kind !== 'cpu' && e.kind !== 'gpu') problems.push(`${where}: kind must be "cpu" or "gpu"`);
    if (e.kind === 'cpu' && !cpuNames.has(e.part)) problems.push(`${where}: unknown CPU "${e.part}"`);
    if (e.kind === 'gpu' && !gpuNames.has(e.part)) problems.push(`${where}: unknown GPU "${e.part}"`);
    if (e.kind === 'gpu' && !RESOLUTIONS.includes(e.resolution as Resolution))
      problems.push(`${where}: GPU entries need resolution ${RESOLUTIONS.join(', ')}`);
    if (!(typeof e.fps === 'number' && e.fps > 0 && e.fps < 2000)) problems.push(`${where}: fps must be a number between 0 and 2000`);
    if (!e.source?.trim()) problems.push(`${where}: source is required`);
    const key = `${e.game}|${e.kind}|${e.part}|${e.kind === 'gpu' ? e.resolution : ''}`;
    if (seen.has(key)) problems.push(`${where}: duplicate entry`);
    seen.add(key);
  });
  return problems;
}

/**
 * Attach measurements to games and calibrate their loads. Unknown names are
 * skipped here (validateBenchmarks reports them). Returns new game objects.
 */
export function applyBenchmarks(games: Game[], cpus: Cpu[], gpus: Gpu[], entries: BenchmarkEntry[]): Game[] {
  if (!entries.length) return games;
  const cpuByName = new Map(cpus.map((c) => [c.name, c]));
  const gpuByName = new Map(gpus.map((g) => [g.name, g]));
  const byGame = new Map<string, BenchmarkEntry[]>();
  for (const e of entries) byGame.set(e.game, [...(byGame.get(e.game) ?? []), e]);

  return games.map((game) => {
    const list = byGame.get(game.name);
    if (!list) return game;
    const cpu = new Map<string, BenchmarkEntry>();
    const gpu = new Map<string, BenchmarkEntry>();
    const cpuLoads: number[] = [];
    const gpuLoads: number[] = [];
    for (const e of list) {
      if (e.kind === 'cpu') {
        const part = cpuByName.get(e.part);
        if (!part) continue;
        cpu.set(e.part, e);
        cpuLoads.push(e.fps / (part.gamingScore * PRESET_CPU_SCALE[PRESET]));
      } else {
        const part = gpuByName.get(e.part);
        if (!part || !e.resolution || !RESOLUTIONS.includes(e.resolution)) continue;
        gpu.set(gpuBenchKey(e.part, e.resolution), e);
        // Skip VRAM-starved results for calibration: they reflect the memory shortfall, not the card's speed.
        if (part.vramGB >= game.vramGB * RESOLUTION_VRAM_SCALE[e.resolution]) {
          gpuLoads.push(e.fps / (part.rasterScore * RESOLUTION_GPU_SCALE[e.resolution] * PRESET_GPU_SCALE[PRESET]));
        }
      }
    }
    return {
      ...game,
      cpuLoad: cpuLoads.length ? median(cpuLoads) : game.cpuLoad,
      gpuLoad: gpuLoads.length ? median(gpuLoads) : game.gpuLoad,
      benchmarks: { cpu, gpu, calibratedFrom: { cpu: cpuLoads.length, gpu: gpuLoads.length } },
    };
  });
}

/** Number of measurements for a game (0 if none). */
export const benchmarkCount = (game: Game) => (game.benchmarks ? game.benchmarks.cpu.size + game.benchmarks.gpu.size : 0);
