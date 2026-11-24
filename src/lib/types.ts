export type PlatformId = 'pc' | 'ps2-xbox' | 'ps3-x360' | 'ps4-xone' | 'ps5-xsx' | 'switch' | 'wii';

/** How a game's FPS coefficients were estimated. */
export type PerfBasis = 'native' | 'port' | 'emulation';

export interface Game {
  /** Unique, stable id (derived at load time). */
  id: string;
  platform: PlatformId;
  /** Other console generations where this game is a top-15 title. */
  alsoOn?: PlatformId[];
  /** Present when the same game is on Steam (art + store link). */
  steamAppId?: number;
  /** English Wikipedia article for cover art when there is no Steam version. */
  wikiTitle?: string;
  /** Measured results attached from benchmarks.json (see lib/benchmarks.ts). */
  benchmarks?: import('./benchmarks').GameBenchmarks;
  name: string;
  releaseYear: number;
  genre: string;
  cpuLoad: number;
  gpuLoad: number;
  vramGB: number;
  ramMinGB: number;
  ramRecGB: number;
}

export interface Cpu {
  name: string;
  brand: string;
  year: number;
  /** Launch month, 1-12. */
  month: number;
  /** RAM type the CPU's platform uses. */
  memory: 'DDR4' | 'DDR5';
  gamingScore: number;
}

export interface Gpu {
  name: string;
  brand: string;
  year: number;
  /** Launch month, 1-12. */
  month: number;
  rasterScore: number;
  vramGB: number;
}

export interface RamOption {
  sizeGB: number;
}

/** Parts lists are sorted weakest -> strongest; list index == tier. */
export interface Catalog {
  games: Game[];
  cpus: Cpu[];
  gpus: Gpu[];
  ram: RamOption[];
}

/** A guess or answer expressed as tier indices into the catalog lists. */
export interface BuildIdx {
  cpu: number;
  gpu: number;
  ram: number;
}

export type PartKey = keyof BuildIdx;
export const PART_KEYS: PartKey[] = ['cpu', 'gpu', 'ram'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 2024" for a launch year + month. */
export function formatLaunch(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? ''} ${year}`.trim();
}

/** Sortable launch key: 202411 for Nov 2024. */
export const launchKey = (year: number, month: number) => year * 100 + month;
