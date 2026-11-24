import { MAX_GUESSES } from './config';
import { addDays } from './date';

/** Guesses are stored by part name / size so data reordering can't corrupt them. */
export interface StoredGuess {
  cpu: string;
  gpu: string;
  ramGB: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface DayState {
  dateKey: string;
  guesses: StoredGuess[];
  status: GameStatus;
}

export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** distribution[i] = wins in i+1 guesses. */
  distribution: number[];
  lastPlayedDate: string | null;
  lastWonDate: string | null;
}

export interface Settings {
  colorblind: boolean;
  seenHelp: boolean;
}

const KEYS = { state: 'rigdle:state', stats: 'rigdle:stats', settings: 'rigdle:settings' };

export const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: Array(MAX_GUESSES).fill(0),
  lastPlayedDate: null,
  lastWonDate: null,
});

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode etc.): play continues without saving */
  }
}

export function loadDayState(dateKey: string): DayState {
  const s = read<DayState>(KEYS.state);
  if (s && s.dateKey === dateKey && Array.isArray(s.guesses)) return s;
  return { dateKey, guesses: [], status: 'playing' };
}
export const saveDayState = (s: DayState) => write(KEYS.state, s);

export function loadStats(): Stats {
  const s = read<Partial<Stats>>(KEYS.stats);
  const base = emptyStats();
  if (!s) return base;
  const merged = { ...base, ...s };
  if (!Array.isArray(merged.distribution) || merged.distribution.length !== MAX_GUESSES) {
    merged.distribution = base.distribution;
  }
  return merged;
}
export const saveStats = (s: Stats) => write(KEYS.stats, s);

export function loadSettings(): Settings {
  return { colorblind: false, seenHelp: false, ...read<Partial<Settings>>(KEYS.settings) };
}
export const saveSettings = (s: Settings) => write(KEYS.settings, s);

/** Pure: stats after finishing the puzzle for `dateKey`. Idempotent per date. */
export function recordResult(stats: Stats, dateKey: string, won: boolean, guessCount: number): Stats {
  if (stats.lastPlayedDate === dateKey) return stats;
  const next: Stats = { ...stats, distribution: [...stats.distribution], played: stats.played + 1, lastPlayedDate: dateKey };
  if (won) {
    next.wins += 1;
    next.distribution[guessCount - 1] += 1;
    next.currentStreak = stats.lastWonDate === addDays(dateKey, -1) ? stats.currentStreak + 1 : 1;
    next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
    next.lastWonDate = dateKey;
  } else {
    next.currentStreak = 0;
  }
  return next;
}

/** Streak as displayed: broken if the last win was before yesterday. */
export function effectiveStreak(stats: Stats, todayKey: string): number {
  if (!stats.lastWonDate) return 0;
  return stats.lastWonDate === todayKey || stats.lastWonDate === addDays(todayKey, -1) ? stats.currentStreak : 0;
}
