import { describe, expect, it } from 'vitest';
import { padDistribution, effectiveStreak, emptyEndlessStats, emptyStats, recordEndless, recordResult } from './storage';

describe('stats', () => {
  it('tracks wins, streaks and distribution', () => {
    let s = emptyStats();
    s = recordResult(s, '2027-01-01', true, 3);
    s = recordResult(s, '2027-01-02', true, 4);
    expect(s).toMatchObject({ played: 2, wins: 2, currentStreak: 2, maxStreak: 2 });
    expect(s.distribution).toEqual([0, 0, 1, 1, 0, 0, 0, 0]);
    s = recordResult(s, '2027-01-03', false, 6);
    expect(s).toMatchObject({ played: 3, wins: 2, currentStreak: 0, maxStreak: 2 });
    s = recordResult(s, '2027-01-05', true, 1);
    expect(s.currentStreak).toBe(1);
  });
  it('is idempotent for the same day', () => {
    const s = recordResult(emptyStats(), '2027-01-01', true, 2);
    expect(recordResult(s, '2027-01-01', true, 2)).toBe(s);
  });
  it('shows a broken streak as 0 after a missed day', () => {
    const s = recordResult(emptyStats(), '2027-01-01', true, 2);
    expect(effectiveStreak(s, '2027-01-02')).toBe(1);
    expect(effectiveStreak(s, '2027-01-03')).toBe(0);
  });
});

describe('endless stats', () => {
  it('counts consecutive wins as the streak', () => {
    let s = emptyEndlessStats();
    s = recordEndless(s, true, 2);
    s = recordEndless(s, true, 5);
    expect(s).toMatchObject({ played: 2, wins: 2, streak: 2, best: 2 });
    s = recordEndless(s, false, 6);
    expect(s).toMatchObject({ played: 3, wins: 2, streak: 0, best: 2 });
    expect(s.distribution).toEqual([0, 1, 0, 0, 1, 0, 0, 0]);
  });
});

describe('guess limits', () => {
  it('normal mode has 6 guesses and hard mode 8', async () => {
    const { maxGuesses } = await import('./config');
    expect(maxGuesses(false)).toBe(6);
    expect(maxGuesses(true)).toBe(8);
  });
  it('records 7- and 8-guess hard-mode wins in the distribution', () => {
    let s = emptyStats();
    s = recordResult(s, '2027-01-01', true, 8);
    s = recordResult(s, '2027-01-02', true, 7);
    expect(s.distribution).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
  });
  it('pads old 6-entry saved distributions instead of resetting them', () => {
    expect(padDistribution([1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5, 6, 0, 0]);
    expect(padDistribution(undefined)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

import { loadDayState, loadStats, saveDayState, voidDaily } from './storage';
describe('voidDaily (Build planner)', () => {
  it("ends today's Daily as a loss once, and does nothing if it's already finished", () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    saveDayState({ dateKey: '2027-02-01', guesses: [], status: 'playing' });
    expect(voidDaily('2027-02-01')).toBe(true);
    expect(loadDayState('2027-02-01').status).toBe('lost');
    expect(loadStats()).toMatchObject({ played: 1, wins: 0, currentStreak: 0, lastPlayedDate: '2027-02-01' });
    expect(voidDaily('2027-02-01')).toBe(false);
    expect(loadStats().played).toBe(1);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
