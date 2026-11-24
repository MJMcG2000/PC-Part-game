import { describe, expect, it } from 'vitest';
import { evaluateGuess, isWin, tileEmoji, tileFor } from './feedback';
import { buildShareText } from './share';

describe('feedback tiles', () => {
  it('green on exact match', () => {
    expect(tileFor('cpu', 5, 5)).toEqual({ part: 'cpu', color: 'green', direction: null });
  });
  it('yellow one tier away with direction', () => {
    expect(tileFor('gpu', 4, 5)).toEqual({ part: 'gpu', color: 'yellow', direction: 'up' });
    expect(tileFor('gpu', 6, 5)).toEqual({ part: 'gpu', color: 'yellow', direction: 'down' });
  });
  it('gray further away: up = too weak, down = overkill', () => {
    expect(tileFor('ram', 0, 2)).toEqual({ part: 'ram', color: 'gray', direction: 'up' });
    expect(tileFor('ram', 3, 1)).toEqual({ part: 'ram', color: 'gray', direction: 'down' });
  });
  it('evaluates a full guess in CPU, GPU, RAM order', () => {
    const tiles = evaluateGuess({ cpu: 3, gpu: 10, ram: 1 }, { cpu: 4, gpu: 6, ram: 1 });
    expect(tiles.map((t) => [t.part, t.color, t.direction])).toEqual([
      ['cpu', 'yellow', 'up'],
      ['gpu', 'gray', 'down'],
      ['ram', 'green', null],
    ]);
    expect(isWin(tiles)).toBe(false);
    expect(isWin(evaluateGuess({ cpu: 1, gpu: 2, ram: 3 }, { cpu: 1, gpu: 2, ram: 3 }))).toBe(true);
  });
  it('swaps emoji in colorblind mode', () => {
    expect(tileEmoji('green')).toBe('🟩');
    expect(tileEmoji('green', true)).toBe('🟧');
    expect(tileEmoji('yellow', true)).toBe('🟦');
  });
});

describe('share text', () => {
  const answer = { cpu: 4, gpu: 6, ram: 1 };
  const rows = [
    evaluateGuess({ cpu: 3, gpu: 2, ram: 1 }, answer),
    evaluateGuess({ cpu: 4, gpu: 5, ram: 1 }, answer),
    evaluateGuess(answer, answer),
  ];
  it('matches the Wordle-style format and omits the game', () => {
    expect(buildShareText({ number: 42, targetFps: 144, rows, won: true })).toBe(
      'Rigdle #42 3/6 🎯144 FPS\n🟨⬛🟩\n🟩🟨🟩\n🟩🟩🟩',
    );
  });
  it('uses X/6 on a loss', () => {
    expect(buildShareText({ number: 7, targetFps: 60, rows: rows.slice(0, 1), won: false })).toMatch(/^Rigdle #7 X\/6/);
  });
});

import { possibleRange } from './feedback';
describe('possibleRange', () => {
  it('narrows from gray and yellow feedback', () => {
    const t = (guess: number, answer: number) => ({ guess, tile: tileFor('cpu', guess, answer) });
    expect(possibleRange([], 10)).toEqual([0, 9]);
    expect(possibleRange([t(2, 6)], 10)).toEqual([4, 9]);
    expect(possibleRange([t(2, 6), t(9, 6)], 10)).toEqual([4, 7]);
    expect(possibleRange([t(5, 6)], 10)).toEqual([6, 6]);
    expect(possibleRange([t(6, 6)], 10)).toEqual([6, 6]);
  });
});
