import { describe, expect, it } from 'vitest';
import { applyBenchmarks, validateBenchmarks, type BenchmarkEntry } from './benchmarks';
import { buildCatalog, catalog, benchmarkEntries } from './data';
import { buildFps, cpuFps, gpuFps } from './fps';
import { testGame, tinyCatalog } from './fixtures';

const base = tinyCatalog([testGame({ name: 'Bench Game', cpuLoad: 1, gpuLoad: 1, vramGB: 4 })]);
const withBench = (entries: BenchmarkEntry[]) => buildCatalog(base.games, base.cpus, base.gpus, base.ram, entries);
const e = (over: Partial<BenchmarkEntry>): BenchmarkEntry => ({ game: 'Bench Game', kind: 'gpu', part: 'GPU 100', resolution: '1080p', fps: 150, source: 'Lab', ...over });

describe('benchmark data', () => {
  it('the shipped benchmark file is valid', () => {
    expect(validateBenchmarks(benchmarkEntries, catalog.games, catalog.cpus, catalog.gpus)).toEqual([]);
  });

  it('a measured GPU result replaces the model for that GPU and resolution only', () => {
    const c = withBench([e({ fps: 150 })]);
    const g = c.games[0];
    const gpu100 = c.gpus.find((x) => x.name === 'GPU 100')!;
    expect(gpuFps(gpu100, g, '1080p')).toBe(150);
    expect(buildFps(c.cpus[3], gpu100, 16, g, '1080p').gpuSource?.source).toBe('Lab');
    expect(buildFps(c.cpus[3], gpu100, 16, g, '1440p').gpuSource).toBeNull();
  });

  it('measurements calibrate the game load so untested parts follow them', () => {
    // Model: GPU 100 x gpuLoad 1 = 100 FPS. Measured 150 => gpuLoad 1.5 => GPU 300 estimates 450.
    const c = withBench([e({ fps: 150 })]);
    const g = c.games[0];
    expect(g.gpuLoad).toBeCloseTo(1.5);
    expect(gpuFps(c.gpus.find((x) => x.name === 'GPU 300')!, g, '1080p')).toBeCloseTo(450);
    expect(g.benchmarks?.calibratedFrom).toEqual({ cpu: 0, gpu: 1 });
  });

  it('a measured CPU result replaces cpuFps and calibrates cpuLoad', () => {
    const c = withBench([e({ kind: 'cpu', part: 'CPU 100', resolution: undefined, fps: 80 })]);
    const g = c.games[0];
    expect(cpuFps(c.cpus.find((x) => x.name === 'CPU 100')!, g)).toBe(80);
    expect(cpuFps(c.cpus.find((x) => x.name === 'CPU 200')!, g)).toBeCloseTo(160);
  });

  it('games without measurements are untouched', () => {
    const games = [testGame({ name: 'Other' })];
    expect(applyBenchmarks(games, base.cpus, base.gpus, [e({})])[0]).toBe(games[0]);
  });

  it('reports unknown names, missing resolution, bad fps and duplicates', () => {
    const problems = validateBenchmarks(
      [e({ game: 'Nope' }), e({ part: 'GPU 999' }), e({ resolution: undefined }), e({ fps: -1 }), e({}), e({})],
      base.games,
      base.cpus,
      base.gpus,
    );
    expect(problems.join('\n')).toMatch(/unknown game/);
    expect(problems.join('\n')).toMatch(/unknown GPU/);
    expect(problems.join('\n')).toMatch(/need resolution/);
    expect(problems.join('\n')).toMatch(/fps must be/);
    expect(problems.join('\n')).toMatch(/duplicate/);
  });
});
