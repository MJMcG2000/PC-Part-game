import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatCountdown, msUntilNextMidnight, puzzleNumber, toDateKey } from './date';
import { LAUNCH_DATE } from './config';

describe('date helpers', () => {
  it('formats local dates', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('adds days across month/year/DST boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
  it('numbers puzzles from the launch date', () => {
    expect(puzzleNumber(LAUNCH_DATE)).toBe(1);
    expect(puzzleNumber(addDays(LAUNCH_DATE, 41))).toBe(42);
  });
  it('counts down to local midnight', () => {
    expect(msUntilNextMidnight(new Date(2026, 5, 1, 23, 59, 0))).toBe(60_000);
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
  });
});
