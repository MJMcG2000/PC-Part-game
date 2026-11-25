import { describe, expect, it } from 'vitest';
import { checkPuzzle, generatePuzzle, getPuzzle } from './puzzle';
import { catalog, buildCatalog } from './data';
import { addDays } from './date';
import { testGame, tinyCatalog } from './fixtures';
import { FPS_TARGETS, NO_REPEAT_DAYS } from './config';
import { analyzeSequence } from './validate';
import { generateEndless, puzzleFromSaved } from './puzzle';
import { matchesPlatform, repeatKey } from './platforms';
import { PLATFORMS } from './platforms';

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
    const ids = new Set(keys.map((k) => getPuzzle(k).game.id));
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
  });

  it('allows 8 GB and 64 GB RAM answers, but not RAM beyond the largest option', () => {
    expect(checkPuzzle(testGame({ ramRecGB: 8 }), 90, cat)).toMatchObject({ valid: true, answer: { ram: 0 } });
    expect(checkPuzzle(testGame({ ramRecGB: 64 }), 90, cat)).toMatchObject({ valid: true, answer: { ram: 3 } });
    expect(checkPuzzle(testGame({ ramRecGB: 128 }), 90, cat)).toEqual({ valid: false, reason: 'unreachable' });
  });

  it('accepts an interior answer', () => {
    // CPU 100 (idx 1), GPU 100 (idx 2: GPU 90 is VRAM-penalized), 16GB (idx 1)
    expect(checkPuzzle(game, 90, cat)).toEqual({ valid: true, answer: { cpu: 1, gpu: 2, ram: 1 } });
  });

  it('rerolls deterministically until it finds a valid puzzle', () => {
    // One valid game hidden among many that are never valid (RAM need is unreachable).
    const bad = Array.from({ length: 20 }, (_, i) => testGame({ steamAppId: 100 + i, ramRecGB: 128 }));
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
      expect(generatePuzzle(addDays('2027-01-01', i), new Set(['test game 1']), c).game.steamAppId).toBe(2);
    }
  });

  it('throws when no valid puzzle exists at all', () => {
    expect(() => generatePuzzle('2027-01-01', new Set(), tinyCatalog([testGame({ ramRecGB: 128 })]))).toThrow();
  });

  it(`does not repeat a game within ${NO_REPEAT_DAYS} days`, () => {
    const r = analyzeSequence('2027-01-01', 120, buildCatalog(catalog.games, catalog.cpus, catalog.gpus, catalog.ram));
    expect(r.problems).toEqual([]);
  });

  it('every generated puzzle is valid', () => {
    for (let i = 0; i < 200; i++) {
      const p = getPuzzle(addDays('2026-12-01', i));
      expect(checkPuzzle(p.game, p.targetFps, catalog, p.resolution).valid).toBe(true);
    }
  });
});

describe('platforms and endless mode', () => {
  it('has unique game ids and at least 15 games per home-console generation', () => {
    expect(new Set(catalog.games.map((g) => g.id)).size).toBe(catalog.games.length);
    for (const p of PLATFORMS.filter((x) => x.id !== 'pc' && !x.handheld)) {
      expect(catalog.games.filter((g) => matchesPlatform(g, p.id)).length, p.label).toBeGreaterThanOrEqual(15);
    }
  });

  it('includes Minecraft and every Pokémon game on Switch and Wii', () => {
    const names = catalog.games.map((g) => g.name);
    expect(names).toContain('Minecraft: Java Edition');
    const pokemon = catalog.games.filter((g) => /Pok[eé]|Pikachu|Pokkén/i.test(g.name));
    expect(pokemon.filter((g) => g.platform === 'switch').length).toBe(12);
    expect(pokemon.filter((g) => g.platform === 'wii').length).toBe(4);
    for (const g of [...pokemon, catalog.games.find((x) => x.name === 'Minecraft: Java Edition')!]) {
      expect(FPS_TARGETS.some((t) => checkPuzzle(g, t).valid || checkPuzzle(g, t, catalog, '1440p').valid), g.name).toBe(true);
    }
  });

  it('treats the same title on different platforms as one game for repeats', () => {
    const a = catalog.games.find((g) => g.name === 'Grand Theft Auto V')!;
    const b = catalog.games.find((g) => g.name === 'Grand Theft Auto V (PS3/360)')!;
    expect(repeatKey(a)).toBe(repeatKey(b));
  });

  it('endless puzzles respect the platform filter and are valid', () => {
    for (const p of PLATFORMS) {
      for (let i = 0; i < 25; i++) {
        const z = generateEndless(`s${i}`, p.id, []);
        expect(matchesPlatform(z.game, p.id)).toBe(true);
        expect(checkPuzzle(z.game, z.targetFps, catalog, z.resolution).valid).toBe(true);
      }
    }
  });

  it('endless avoids recently played games', () => {
    const recent: string[] = [];
    for (let i = 0; i < 7; i++) {
      const z = generateEndless(`r${i}`, 'wii', recent);
      expect(recent).not.toContain(repeatKey(z.game));
      recent.push(repeatKey(z.game));
    }
  });

  it('restores a saved endless puzzle with the same answer', () => {
    const z = generateEndless('restore', 'all', []);
    const r = puzzleFromSaved(z.game.id, z.targetFps, z.resolution)!;
    expect(r.answer).toEqual(z.answer);
    expect(puzzleFromSaved('nope', 60)).toBeNull();
  });
});

describe('resolutions', () => {
  it('daily puzzles use 1080p, 1440p and 4K', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => getPuzzle(addDays('2027-01-01', i)).resolution));
    expect([...seen].sort()).toEqual(['1080p', '1440p', '4K']);
  });

  it('higher resolutions need an equal or stronger GPU, never a different CPU', () => {
    const game = catalog.games.find((g) => g.name === 'Cyberpunk 2077')!;
    const a = checkPuzzle(game, 90, catalog, '1080p');
    const b = checkPuzzle(game, 90, catalog, '1440p');
    const c = checkPuzzle(game, 90, catalog, '4K');
    expect(a.valid && b.valid && c.valid).toBe(true);
    if (a.valid && b.valid && c.valid) {
      expect(b.answer.gpu).toBeGreaterThanOrEqual(a.answer.gpu);
      expect(c.answer.gpu).toBeGreaterThan(b.answer.gpu);
      expect(new Set([a.answer.cpu, b.answer.cpu, c.answer.cpu]).size).toBe(1);
    }
  });
});

import { acceptedAnswers } from './puzzle';
import { brandTile, evaluateBuild, isWin } from './feedback';
import { cpuFps, gpuFps } from './fps';
describe('either brand counts', () => {
  const days = Array.from({ length: 120 }, (_, i) => getPuzzle(addDays('2027-01-01', i)));

  it('the overall minimum is always one of the per-brand minimums', () => {
    for (const p of days) {
      const a = acceptedAnswers(p);
      expect(Object.values(a.cpu)).toContain(p.answer.cpu);
      expect(Object.values(a.gpu)).toContain(p.answer.gpu);
      expect(a.ram).toBe(p.answer.ram);
    }
  });

  it('each brand minimum reaches the target and the part below it (same brand) does not', () => {
    for (const p of days) {
      const a = acceptedAnswers(p);
      for (const [brand, i] of Object.entries(a.gpu)) {
        if (i === null) continue;
        expect(gpuFps(catalog.gpus[i], p.game, p.resolution) + 1e-6).toBeGreaterThanOrEqual(p.targetFps);
        const weaker = catalog.gpus.slice(0, i).filter((g) => g.brand === brand);
        for (const g of weaker) expect(gpuFps(g, p.game, p.resolution)).toBeLessThan(p.targetFps);
      }
      for (const [, i] of Object.entries(a.cpu)) {
        if (i !== null) expect(cpuFps(catalog.cpus[i], p.game) + 1e-6).toBeGreaterThanOrEqual(p.targetFps);
      }
    }
  });

  it('a guess with the other brand\'s minimum CPU and GPU wins', () => {
    const p = days.find((d) => {
      const a = acceptedAnswers(d);
      return Object.values(a.cpu).every((x) => x !== null) && Object.values(a.gpu).every((x) => x !== null);
    })!;
    const a = acceptedAnswers(p);
    for (const cpu of Object.values(a.cpu) as number[]) {
      for (const gpu of Object.values(a.gpu) as number[]) {
        expect(isWin(evaluateBuild({ cpu, gpu, ram: a.ram }, a, catalog))).toBe(true);
      }
    }
  });

  it('tiles compare within the guessed brand', () => {
    const parts = [{ brand: 'A' }, { brand: 'B' }, { brand: 'A' }, { brand: 'B' }, { brand: 'A' }];
    // A-list: [0, 2, 4]; B-list: [1, 3]. A's minimum is index 4, B's is index 1.
    const answers = { A: 4, B: 1 };
    expect(brandTile('gpu', 4, parts, answers).color).toBe('green');
    expect(brandTile('gpu', 1, parts, answers).color).toBe('green');
    expect(brandTile('gpu', 2, parts, answers)).toMatchObject({ color: 'yellow', direction: 'up' });
    expect(brandTile('gpu', 0, parts, answers)).toMatchObject({ color: 'gray', direction: 'up' });
    expect(brandTile('gpu', 3, parts, answers)).toMatchObject({ color: 'yellow', direction: 'down' });
    // A brand with no part fast enough: always gray, too weak.
    expect(brandTile('gpu', 1, parts, { A: 4, B: null })).toMatchObject({ color: 'gray', direction: 'up' });
  });
});

describe('handheld Pokémon games', () => {
  it('adds Game Boy/GBA, DS and 3DS platforms with at least 12 games each', () => {
    for (const id of ['gb-gba', 'ds', '3ds'] as const) {
      expect(catalog.games.filter((g) => g.platform === id).length, id).toBeGreaterThanOrEqual(12);
    }
  });

  it('handheld games may have the weakest part as the answer; other games may not', () => {
    // A handheld game so light that even the weakest parts beat the target.
    const red = { ...catalog.games.find((g) => g.name === 'Pokémon Red and Blue')!, cpuLoad: 100, gpuLoad: 1000 };
    const v = checkPuzzle(red, 60);
    expect(v.valid).toBe(true);
    if (v.valid) expect(v.answer.cpu).toBe(0);
    const pcGame = { ...red, platform: 'pc' as const };
    expect(checkPuzzle(pcGame, 60)).toMatchObject({ valid: false, reason: 'cpu-extreme' });
  });

  it('handheld games still never ask for the strongest part', () => {
    for (const g of catalog.games.filter((x) => ['gb-gba', 'ds', '3ds'].includes(x.platform))) {
      for (const t of FPS_TARGETS) {
        const v = checkPuzzle(g, t);
        if (v.valid) {
          expect(v.answer.cpu).toBeLessThan(catalog.cpus.length - 1);
          expect(v.answer.gpu).toBeLessThan(catalog.gpus.length - 1);
        }
      }
    }
  });
});

describe('handheld weighting', () => {
  it('handheld games are rare in Daily (at most 12% of a year)', () => {
    const year = Array.from({ length: 365 }, (_, i) => getPuzzle(addDays('2027-01-01', i)));
    const handheld = year.filter((p) => ['gb-gba', 'ds', '3ds'].includes(p.game.platform)).length;
    expect(handheld / 365).toBeLessThanOrEqual(0.12);
    expect(handheld).toBeGreaterThan(0);
  });
  it('a handheld-only Endless filter still serves its games', () => {
    for (let i = 0; i < 10; i++) expect(generateEndless(`h${i}`, 'ds', []).game.platform).toBe('ds');
  });
});

import { gpuChecker } from './board';
describe('GPU arrows never say "go weaker" for a card that misses the target', () => {
  it('holds for a year of daily puzzles', () => {
    for (let i = 0; i < 365; i++) {
      const p = getPuzzle(addDays('2026-12-01', i));
      const a = acceptedAnswers(p);
      const check = gpuChecker(p);
      catalog.gpus.forEach((_, gpu) => {
        const t = evaluateBuild({ cpu: p.answer.cpu, gpu, ram: a.ram }, a, catalog, check)[1];
        if (check(gpu).misses) expect(t.direction).toBe('up');
      });
    }
  });
});
