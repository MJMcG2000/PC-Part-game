import { describe, expect, it } from 'vitest';
import { hashString, mulberry32 } from './rng';

describe('rng', () => {
  it('hashString is stable and sensitive to input', () => {
    expect(hashString('2026-12-01')).toBe(hashString('2026-12-01'));
    expect(hashString('2026-12-01')).not.toBe(hashString('2026-12-02'));
  });

  it('mulberry32 yields the same stream for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 20 }, () => a());
    expect(Array.from({ length: 20 }, () => b())).toEqual(xs);
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0), expect(x).toBeLessThan(1);
  });
});
