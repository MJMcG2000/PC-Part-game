import gamesJson from '../data/games.json';
import cpusJson from '../data/cpus.json';
import gpusJson from '../data/gpus.json';
import ramJson from '../data/ram.json';
import type { Catalog, Cpu, Game, Gpu, RamOption } from './types';

/** Sort parts weakest -> strongest; ties broken by year then name for stability. */
export function buildCatalog(games: Game[], cpus: Cpu[], gpus: Gpu[], ram: RamOption[]): Catalog {
  return {
    games: [...games],
    cpus: [...cpus].sort((a, b) => a.gamingScore - b.gamingScore || a.year - b.year || a.name.localeCompare(b.name)),
    gpus: [...gpus].sort((a, b) => a.rasterScore - b.rasterScore || a.year - b.year || a.name.localeCompare(b.name)),
    ram: [...ram].sort((a, b) => a.sizeGB - b.sizeGB),
  };
}

export const catalog: Catalog = buildCatalog(
  gamesJson.items as Game[],
  cpusJson.items as Cpu[],
  gpusJson.items as Gpu[],
  ramJson.items as RamOption[],
);
