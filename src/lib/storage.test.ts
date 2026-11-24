import { describe, expect, it } from 'vitest';
import { effectiveStreak, emptyStats, recordResult } from './storage';

describe('stats', () => {
  it('tracks wins, streaks and distribution', () => {
    let s = emptyStats();
    s = recordResult(s, '2027-01-01', true, 3);
    s = recordResult(s, '2027-01-02', true, 4);
    expect(s).toMatchObject({ played: 2, wins: 2, currentStreak: 2, maxStreak: 2 });
    expect(s.distribution).toEqual([0, 0, 1, 1, 0, 0]);
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
