import type { Game, PerfBasis, PlatformId } from './types';

export interface PlatformInfo {
  id: PlatformId;
  label: string;
  short: string;
  basis: PerfBasis;
  /**
   * Handheld consoles are so light to emulate that the weakest CPU/GPU is often
   * enough, so their puzzles may have the weakest part as the answer.
   */
  handheld?: boolean;
}

export const PLATFORMS: PlatformInfo[] = [
  { id: 'pc', label: 'PC', short: 'PC', basis: 'native' },
  { id: 'ps2-xbox', label: 'PS2 / Xbox', short: 'PS2/Xbox', basis: 'emulation' },
  { id: 'ps3-x360', label: 'PS3 / Xbox 360', short: 'PS3/360', basis: 'emulation' },
  { id: 'ps4-xone', label: 'PS4 / Xbox One', short: 'PS4/One', basis: 'port' },
  { id: 'ps5-xsx', label: 'PS5 / Xbox Series X|S', short: 'PS5/Series', basis: 'port' },
  { id: 'switch', label: 'Nintendo Switch', short: 'Switch', basis: 'emulation' },
  { id: 'wii', label: 'Nintendo Wii', short: 'Wii', basis: 'emulation' },
  { id: 'gb-gba', label: 'Game Boy / GBA', short: 'GB/GBA', basis: 'emulation', handheld: true },
  { id: 'ds', label: 'Nintendo DS', short: 'DS', basis: 'emulation', handheld: true },
  { id: '3ds', label: 'Nintendo 3DS', short: '3DS', basis: 'emulation', handheld: true },
];

export const platformInfo = (id: PlatformId): PlatformInfo => PLATFORMS.find((p) => p.id === id)!;

export const BASIS_LABEL: Record<PerfBasis, string> = {
  native: 'PC performance',
  port: 'Estimated PC port',
  emulation: 'Estimated via PC emulation',
};

/** 'all' or a platform; a game matches its own platform and any `alsoOn` tags. */
export type PlatformFilter = 'all' | PlatformId;

export function matchesPlatform(game: Game, filter: PlatformFilter): boolean {
  return filter === 'all' || game.platform === filter || (game.alsoOn ?? []).includes(filter);
}

/** Key for the no-repeat rule: the same title on two platforms counts as one game. */
export function repeatKey(game: Game): string {
  return game.name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
