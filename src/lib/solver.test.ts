import { describe, expect, it } from 'vitest';
import { buildFps, cpuFps, gpuFps, isCloseEnough, ramMultiplier } from './fps';
import { solve, solveCpu, solveGpu, solveRam } from './solver';
import { testGame, tinyCatalog } from './fixtures';
import { catalog } from './data';
import { FPS_TARGETS } from './config';

describe('FPS model', () => {
  const game = testGame({ cpuLoad: 0.5, gpuLoad: 2, vramGB: 6, ramMinGB: 8, ramRecGB: 16 });
  const cat = tinyCatalog([game]);

  it('computes cpu/gpu fps and the VRAM penalty', () => {
    expect(cpuFps(cat.cpus[1], game)).toBe(50); // 100 * 0.5
    expect(gpuFps(cat.gpus[2], game)).toBe(200); // 100 * 2, 8GB >= 6GB
    expect(gpuFps(cat.gpus[1], game)).toBeCloseTo(90 * 2 * 0.6); // 4GB < 6GB
  });

  it('applies RAM multipliers', () => {
    expect(ramMultiplier(16, game)).toBe(1);
    expect(ramMultiplier(8, game)).toBe(0.85);
    expect(ramMultiplier(4, game)).toBe(0.5);
  });

  it('takes the min of cpu and gpu, scaled by RAM', () => {
    const b = buildFps(cat.cpus[3], cat.gpus[2], 8, game); // cpu 100, gpu 200
    expect(b.limitedBy).toBe('cpu');
    expect(b.fps).toBeCloseTo(85);
  });
});

describe('solver', () => {
  const game = testGame({ cpuLoad: 1, gpuLoad: 1, vramGB: 6, ramRecGB: 16 });
  const cat = tinyCatalog([game]);

  it('picks the weakest CPU that reaches the target (exact boundary counts)', () => {
    expect(cat.cpus[solveCpu(game, 100, cat)].name).toBe('CPU 100');
    expect(cat.cpus[solveCpu(game, 101, cat)].name).toBe('CPU 150');
    expect(solveCpu(game, 201, cat)).toBe(-1);
  });

  it('skips GPUs that fall short because of the VRAM penalty', () => {
    // GPU 90 has 4GB < 6GB, so it only does 54 FPS; GPU 100 (8GB) is the answer for 60.
    expect(cat.gpus[solveGpu(game, 60, cat)].name).toBe('GPU 100');
    // With a game that needs only 4GB, GPU 90 qualifies.
    const light = testGame({ vramGB: 4 });
    expect(cat.gpus[solveGpu(light, 60, cat)].name).toBe('GPU 90');
  });

  it('picks the smallest RAM >= recommended', () => {
    expect(cat.ram[solveRam(testGame({ ramRecGB: 12 }), cat)].sizeGB).toBe(16);
    expect(cat.ram[solveRam(testGame({ ramRecGB: 32 }), cat)].sizeGB).toBe(32);
    expect(solveRam(testGame({ ramRecGB: 128 }), cat)).toBe(-1);
  });

  it('returns null when the target is unreachable', () => {
    expect(solve(game, 1000, cat)).toBeNull();
  });

  it('the answer build reaches the target and every one-tier-weaker build does not', () => {
    for (const g of catalog.games) {
      for (const t of FPS_TARGETS) {
        const a = solve(g, t, catalog);
        if (!a) continue;
        const ramGB = catalog.ram[a.ram].sizeGB;
        expect(buildFps(catalog.cpus[a.cpu], catalog.gpus[a.gpu], ramGB, g).fps + 1e-6).toBeGreaterThanOrEqual(t);
        if (a.cpu > 0) expect(cpuFps(catalog.cpus[a.cpu - 1], g)).toBeLessThan(t);
        for (let i = 0; i < a.gpu; i++) expect(gpuFps(catalog.gpus[i], g)).toBeLessThan(t);
      }
    }
  });
});

describe('±10% win rule', () => {
  it('accepts builds within 10% of the target, above or below', () => {
    expect(isCloseEnough(100, 100)).toBe(true);
    expect(isCloseEnough(90, 100)).toBe(true);
    expect(isCloseEnough(110, 100)).toBe(true);
    expect(isCloseEnough(89.9, 100)).toBe(false);
    expect(isCloseEnough(110.1, 100)).toBe(false);
    expect(isCloseEnough(130, 144)).toBe(true);
    expect(isCloseEnough(129, 144)).toBe(false);
  });
});

import { formatLaunch } from './types';
describe('part launch dates', () => {
  it('every CPU and GPU has a launch month and a sensible date', () => {
    for (const p of [...catalog.cpus, ...catalog.gpus]) {
      expect(Number.isInteger(p.month) && p.month >= 1 && p.month <= 12, p.name).toBe(true);
      expect(p.year >= 2016 && p.year <= 2026, p.name).toBe(true);
    }
  });
  it('formats as short month + year', () => {
    expect(formatLaunch(2024, 11)).toBe('Nov 2024');
    expect(formatLaunch(2016, 1)).toBe('Jan 2016');
  });
});

describe('part brands and RAM type', () => {
  it('GPUs are only NVIDIA or AMD; CPUs only AMD (Ryzen) or Intel', () => {
    expect(new Set(catalog.gpus.map((g) => g.brand))).toEqual(new Set(['NVIDIA', 'AMD']));
    expect(new Set(catalog.cpus.map((c) => c.brand))).toEqual(new Set(['AMD', 'Intel']));
    for (const c of catalog.cpus.filter((x) => x.brand === 'AMD')) expect(c.name.startsWith('Ryzen'), c.name).toBe(true);
  });
  it('every CPU has a DDR4 or DDR5 memory type that fits its platform', () => {
    for (const c of catalog.cpus) expect(['DDR4', 'DDR5']).toContain(c.memory);
    const mem = (n: string) => catalog.cpus.find((c) => c.name === n)!.memory;
    expect(mem('Ryzen 7 5800X3D')).toBe('DDR4');
    expect(mem('Ryzen 7 7800X3D')).toBe('DDR5');
    expect(mem('Core i5-11400')).toBe('DDR4');
    expect(mem('Core Ultra 7 265K')).toBe('DDR5');
  });
});
