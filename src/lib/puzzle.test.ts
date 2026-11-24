import { describe, expect, it } from 'vitest';
import { checkPuzzle, generatePuzzle, getPuzzle } from './puzzle';
import { catalog, buildCatalog } from './data';
import { addDays } from './date';
import { testGame, tinyCatalog } from './fixtures';
import { NO_REPEAT_DAYS } from './config';
import { analyzeSequence } from './validate';

describe('seed determinism', () => {
  it('the same date always gives the same puzzle', () => {
    const a = generatePuzzle('2027-03-14');
    const b = generatePuzzle('2027-03-14');
    expect(b).toEqual(a);
    // Even through the chained, memoized path with a fresh catalog object.
    const c = getPuzzle('2027-03-14', { ...catalog });
    const d = getPuzzle('2027-03-14', { ...catalog });
    expect(d.game.steamAppId).toBe(c.game.steamAppId);
    expect(d.targetFps).toBe(c.targetFps);
    expect(d.answer).toEqual(c.answer);
  });

  it('does not depend on the order days are requested in', () => {
    const cat1 = { ...catalog };
    const cat2 = { ...catalog };
    const late = getPuzzle('2027-06-01', cat1);
    getPuzzle('2027-02-01', cat2);
    expect(getPuzzle('2027-06-01', cat2)).toEqual(late);
  });

  it('different dates usually give different puzzles', () => {
    const keys = Array.from({ length: 14 }, (_, i) => addDays('2027-01-01', i));
    const ids = new Set(keys.map((k) => getPuzzle(k).game.steamAppId));
    expect(ids.size).toBe(14);
  });
});

describe('validity and reroll rules', () => {
  const cat = tinyCatalog();
  const game = cat.games[0];

  it('rejects unreachable targets', () => {
    expect(checkPuzzle(game, 500, cat)).toEqual({ valid: false, reason: 'unreachable' });
  });

  it('rejects answers that are the weakest or strongest option', () => {
    expect(checkPuzzle(game, 30, cat)).toMatchObject({ valid: false, reason: 'cpu-extreme' }); // CPU 50
    expect(checkPuzzle(game, 160, cat)).toMatchObject({ valid: false, reason: 'cpu-extreme' }); // CPU 200
    expect(checkPuzzle(testGame({ cpuLoad: 1, gpuLoad: 3, vramGB: 4 }), 90, cat)).toMatchObject({
      valid: false,
      reason: 'gpu-extreme', // GPU 40 * 3 = 120 is weakest
    });
    expect(checkPuzzle(testGame({ ramRecGB: 8 }), 90, cat)).toMatchObject({ valid: false, reason: 'ram-extreme' });
    expect(checkPuzzle(testGame({ ramRecGB: 64 }), 90, cat)).toMatchObject({ valid: false, reason: 'ram-extreme' });
  });

  it('accepts an interior answer', () => {
    // CPU 100 (idx 1), GPU 100 (idx 2: GPU 90 is VRAM-penalized), 16GB (idx 1)
    expect(checkPuzzle(game, 90, cat)).toEqual({ valid: true, answer: { cpu: 1, gpu: 2, ram: 1 } });
  });

  it('rerolls deterministically until it finds a valid puzzle', () => {
    // One valid game hidden among many that are never valid (RAM answer = weakest).
    const bad = Array.from({ length: 20 }, (_, i) => testGame({ steamAppId: 100 + i, ramRecGB: 8 }));
    const good = testGame({ steamAppId: 7 });
    const c = tinyCatalog([...bad, good]);
    const p = generatePuzzle('2027-01-01', new Set(), c);
    expect(p.game.steamAppId).toBe(7);
    expect(checkPuzzle(p.game, p.targetFps, c).valid).toBe(true);
    expect(generatePuzzle('2027-01-01', new Set(), c)).toEqual(p);
  });

  it('never returns a recently used game when an alternative exists', () => {
    const games = [testGame({ steamAppId: 1 }), testGame({ steamAppId: 2 })];
    const c = tinyCatalog(games);
    for (let i = 0; i < 20; i++) {
      expect(generatePuzzle(addDays('2027-01-01', i), new Set([1]), c).game.steamAppId).toBe(2);
    }
  });

  it('throws when no valid puzzle exists at all', () => {
    expect(() => generatePuzzle('2027-01-01', new Set(), tinyCatalog([testGame({ ramRecGB: 8 })]))).toThrow();
  });

  it(`does not repeat a game within ${NO_REPEAT_DAYS} days`, () => {
    const r = analyzeSequence('2027-01-01', 120, buildCatalog(catalog.games, catalog.cpus, catalog.gpus, catalog.ram));
    expect(r.problems).toEqual([]);
  });

  it('every generated puzzle is valid', () => {
    for (let i = 0; i < 200; i++) {
      const p = getPuzzle(addDays('2026-12-01', i));
      expect(checkPuzzle(p.game, p.targetFps).valid).toBe(true);
    }
  });
});
