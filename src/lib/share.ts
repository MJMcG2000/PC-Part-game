import { PRESET, RESOLUTION, maxGuesses } from './config';
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
  /** Hard mode: out of 8 guesses, and the score gets a '*', as in Wordle. */
  hard?: boolean;
  /** Defaults to the configured resolution / preset. */
  resolution?: string;
  preset?: string;
  /** Puzzle date as YYYY-MM-DD (the Daily's date, or the day an Endless rig was played). */
  date?: string;
}

/** "2026-11-25" -> "11/25/2026". */
export function formatShareDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${m}/${d}/${y}`;
}

/**
 * Share text, e.g.
 *   Rigdle #42 3/6
 *   📅 11/25/2026
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
  date,
}: ShareInput): string {
  const label = override ?? (number > 0 ? `#${number}` : 'Preview');
  const max = maxGuesses(hard);
  const score = (won ? `${rows.length}/${max}` : `X/${max}`) + (hard ? '*' : '');
  const grid = rows.map((r) => r.map((t) => tileEmoji(t.color, colorblind)).join(' | '));
  return [`Rigdle ${label} ${score}`, ...(date ? [`📅 ${formatShareDate(date)}`] : []), `🎮 ${gameName}`, `🎯 ${targetFps} FPS @ ${resolution} ${preset}`, 'CPU | GPU | RAM', ...grid].join('\n');
}
