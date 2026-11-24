import { MAX_GUESSES } from './config';
import { tileEmoji, type Tile } from './feedback';

export interface ShareInput {
  number: number;
  targetFps: number;
  rows: Tile[][];
  won: boolean;
  colorblind?: boolean;
  /** Overrides the '#N' label, e.g. 'Endless'. */
  label?: string;
}

/** Wordle-style share text. Never includes the game name (spoilers). */
export function buildShareText({ number, targetFps, rows, won, colorblind = false, label: override }: ShareInput): string {
  const label = override ?? (number > 0 ? `#${number}` : 'Preview');
  const score = won ? `${rows.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const grid = rows.map((r) => r.map((t) => tileEmoji(t.color, colorblind)).join('')).join('\n');
  return `Rigdle ${label} ${score} 🎯${targetFps} FPS\n${grid}`;
}
