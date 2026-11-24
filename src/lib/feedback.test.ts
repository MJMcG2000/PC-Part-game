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
  it('swaps emoji in colorblind mode', () => {
    expect(buildShareText({ number: 1, gameName: 'X', targetFps: 60, rows: rows.slice(2), won: true, colorblind: true })).toMatch(/🟧 \| 🟧 \| 🟧$/);
  });
  const answer = { cpu: 4, gpu: 6, ram: 1 };
  const rows = [
    evaluateGuess({ cpu: 3, gpu: 2, ram: 1 }, answer),
    evaluateGuess({ cpu: 4, gpu: 5, ram: 1 }, answer),
    evaluateGuess(answer, answer),
  ];
  it('matches the Wordle-style format and omits the game', () => {
    expect(buildShareText({ number: 42, gameName: 'Cyberpunk 2077', targetFps: 144, rows, won: true })).toBe(
      'Rigdle #42 3/6\n🎮 Cyberpunk 2077\n🎯 144 FPS @ 1080p High\nCPU | GPU | RAM\n🟨 | ⬛ | 🟩\n🟩 | 🟨 | 🟩\n🟩 | 🟩 | 🟩',
    );
  });
  it('supports an Endless label', () => {
    expect(buildShareText({ number: 0, gameName: 'Wii Sports', label: 'Endless', targetFps: 90, rows: rows.slice(2), won: true })).toBe(
      'Rigdle Endless 1/6\n🎮 Wii Sports\n🎯 90 FPS @ 1080p High\nCPU | GPU | RAM\n🟩 | 🟩 | 🟩',
    );
  });
  it('marks hard mode with a star', () => {
    expect(buildShareText({ number: 42, gameName: 'X', targetFps: 144, rows, won: true, hard: true })).toMatch(/^Rigdle #42 3\/6\*\n/);
  });
  it('uses X/6 on a loss', () => {
    expect(buildShareText({ number: 7, gameName: 'X', targetFps: 60, rows: rows.slice(0, 1), won: false })).toMatch(/^Rigdle #7 X\/6/);
  });
});

import { pickThumbnail } from './coverArt';
describe('cover art', () => {
  it('picks the best-ranked page with a thumbnail', () => {
    expect(
      pickThumbnail({
        query: { pages: { '2': { index: 2, thumbnail: { source: 'b.jpg' } }, '1': { index: 1 }, '3': { index: 3, thumbnail: { source: 'c.jpg' } } } },
      }),
    ).toBe('b.jpg');
    expect(pickThumbnail({})).toBeNull();
  });
});
