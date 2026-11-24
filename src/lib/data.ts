import gamesJson from '../data/games.json';
import consoleGamesJson from '../data/console-games.json';
import cpusJson from '../data/cpus.json';
import gpusJson from '../data/gpus.json';
import ramJson from '../data/ram.json';
import type { Catalog, Cpu, Game, Gpu, PlatformId, RamOption } from './types';

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

type RawGame = Omit<Game, 'id' | 'platform'> & { platform?: PlatformId };

/** Fill in platform (default PC) and a stable id. */
export function normalizeGames(raw: RawGame[]): Game[] {
  return raw.map((g) => {
    const platform = g.platform ?? 'pc';
    const id = platform === 'pc' && g.steamAppId ? `steam-${g.steamAppId}` : `${platform}-${slug(g.name)}`;
    return { ...g, platform, id };
  });
}

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
  normalizeGames([...(gamesJson.items as RawGame[]), ...(consoleGamesJson.items as RawGame[])]),
  cpusJson.items as Cpu[],
  gpusJson.items as Gpu[],
  ramJson.items as RamOption[],
);
