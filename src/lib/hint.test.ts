import { describe, expect, it } from 'vitest';
import { catalog } from './data';
import { getPuzzle, acceptedAnswers } from './puzzle';
import { addDays } from './date';
import { hintLines, hintUnlocked } from './hint';

describe('hint', () => {
  const p = getPuzzle(addDays('2026-12-01', 10));
  const a = acceptedAnswers(p);
  const none = { cpu: false, gpu: false, ram: false };

  it('unlocks after 3 guesses while the puzzle is still being played', () => {
    expect(hintUnlocked(2, false)).toBe(false);
    expect(hintUnlocked(3, false)).toBe(true);
    expect(hintUnlocked(4, true)).toBe(false);
  });

  it('gives the launch year of the selected brand answers and the recommended RAM', () => {
    const lines = hintLines(p.game, a, catalog, { cpu: 'AMD', gpu: 'NVIDIA' }, none);
    expect(lines.map((l) => l.part)).toEqual(['cpu', 'gpu', 'ram']);
    if (a.cpu.AMD !== null) expect(lines[0].text).toContain(String(catalog.cpus[a.cpu.AMD].year));
    if (a.gpu.NVIDIA !== null) expect(lines[1].text).toContain(String(catalog.gpus[a.gpu.NVIDIA].year));
  });

  it('leaves out parts already found and nudges a brand switch when a brand cannot reach the target', () => {
    expect(hintLines(p.game, a, catalog, { cpu: 'AMD', gpu: 'NVIDIA' }, { cpu: true, gpu: false, ram: true }).map((l) => l.part)).toEqual(['gpu']);
    const noAmd = { ...a, gpu: { ...a.gpu, AMD: null } };
    expect(hintLines(p.game, noAmd, catalog, { cpu: 'AMD', gpu: 'AMD' }, none)[1].text).toMatch(/Switch brands/);
  });
});
