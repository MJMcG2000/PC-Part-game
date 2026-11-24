import { LAUNCH_DATE } from './config';

const MS_PER_DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (puzzles reset at local midnight). */
export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Day number for a YYYY-MM-DD key (UTC-based, so DST never skews it). */
export function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function addDays(key: string, n: number): string {
  const t = new Date((dayIndex(key) + n) * MS_PER_DAY);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from);
}

/** Puzzle number: LAUNCH_DATE is #1. Zero or negative means pre-launch. */
export function puzzleNumber(key: string): number {
  return daysBetween(LAUNCH_DATE, key) + 1;
}

/** Milliseconds until the next local midnight. */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
