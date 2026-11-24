export interface Game {
  steamAppId: number;
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
  gamingScore: number;
}

export interface Gpu {
  name: string;
  brand: string;
  year: number;
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
