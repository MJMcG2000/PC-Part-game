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
      ['cpu', 'yellow', null], // yellow never shows a direction
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
  it('scores hard mode out of 8 and marks it with a star', () => {
    expect(buildShareText({ number: 42, gameName: 'X', targetFps: 144, rows, won: true, hard: true })).toMatch(/^Rigdle #42 3\/8\*\n/);
    expect(buildShareText({ number: 42, gameName: 'X', targetFps: 144, rows, won: false, hard: true })).toMatch(/^Rigdle #42 X\/8\*\n/);
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

import { adsenseScriptTag, normalizeAdsenseClient } from './adsense';
describe('adsense config', () => {
  it('accepts only ca-pub- plus 16 digits', () => {
    expect(normalizeAdsenseClient('ca-pub-1234567890123456')).toBe('ca-pub-1234567890123456');
    expect(normalizeAdsenseClient('  ca-pub-1234567890123456 ')).toBe('ca-pub-1234567890123456');
    expect(normalizeAdsenseClient('ca-pub-XXXXXXXXXXXXXXXX')).toBeNull();
    expect(normalizeAdsenseClient('pub-1234567890123456')).toBeNull();
    expect(normalizeAdsenseClient('')).toBeNull();
    expect(normalizeAdsenseClient(undefined)).toBeNull();
  });
  it('builds the loader tag with the client id', () => {
    expect(adsenseScriptTag('ca-pub-1234567890123456')).toContain('adsbygoogle.js?client=ca-pub-1234567890123456');
  });
});

import { applyVram } from './feedback';
describe('VRAM-aware GPU tiles', () => {
  it('a stronger card that misses because of VRAM points up, gray, flagged', () => {
    const t = applyVram({ part: 'gpu', color: 'yellow', direction: 'down' }, { misses: true, vramShort: true });
    expect(t).toEqual({ part: 'gpu', color: 'gray', direction: 'up', vramShort: true });
  });
  it('a weaker card short on VRAM keeps its tile and gets the flag', () => {
    const t = applyVram({ part: 'gpu', color: 'yellow', direction: 'up' }, { misses: true, vramShort: true });
    expect(t).toEqual({ part: 'gpu', color: 'yellow', direction: 'up', vramShort: true });
  });
  it('green and VRAM-fine tiles are unchanged', () => {
    const g = { part: 'gpu' as const, color: 'green' as const, direction: null };
    expect(applyVram(g, { misses: false, vramShort: true })).toBe(g);
    const d = { part: 'gpu' as const, color: 'gray' as const, direction: 'down' as const };
    expect(applyVram(d, { misses: false, vramShort: false })).toBe(d);
  });
});
