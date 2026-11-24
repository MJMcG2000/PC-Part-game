import { MAX_GUESSES, PRESET, RESOLUTION } from './config';
import { tileEmoji, type Tile } from './feedback';

export interface ShareInput {
  number: number;
  gameName: string;
  targetFps: number;
  rows: Tile[][];
  won: boolean;
  colorblind?: boolean;
  /** Overrides the '#N' label, e.g. 'Endless'. */
  label?: string;
  /** Hard mode: score gets a '*', as in Wordle. */
  hard?: boolean;
  /** Defaults to the configured resolution / preset. */
  resolution?: string;
  preset?: string;
}

/**
 * Share text, e.g.
 *   Rigdle #42 3/6
 *   🎮 Cyberpunk 2077
 *   🎯 144 FPS @ 1080p High
 *   CPU | GPU | RAM
 *   🟨 | ⬛ | 🟩
 */
export function buildShareText({
  number,
  gameName,
  targetFps,
  rows,
  won,
  colorblind = false,
  label: override,
  hard = false,
  resolution = RESOLUTION,
  preset = PRESET,
}: ShareInput): string {
  const label = override ?? (number > 0 ? `#${number}` : 'Preview');
  const score = (won ? `${rows.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`) + (hard ? '*' : '');
  const grid = rows.map((r) => r.map((t) => tileEmoji(t.color, colorblind)).join(' | '));
  return [`Rigdle ${label} ${score}`, `🎮 ${gameName}`, `🎯 ${targetFps} FPS @ ${resolution} ${preset}`, 'CPU | GPU | RAM', ...grid].join('\n');
}
