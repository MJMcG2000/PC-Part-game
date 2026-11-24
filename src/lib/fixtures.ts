import { buildCatalog } from './data';
import type { Game } from './types';

/** Small hand-checkable catalog for tests. */
export const testGame = (over: Partial<Game> = {}): Game => ({
  id: `test-${over.steamAppId ?? 1}`,
  platform: 'pc',
  steamAppId: 1,
  name: `Test Game ${over.steamAppId ?? 1}`,
  releaseYear: 2024,
  genre: 'Test',
  cpuLoad: 1,
  gpuLoad: 1,
  vramGB: 6,
  ramMinGB: 8,
  ramRecGB: 16,
  ...over,
});

export const tinyCatalog = (games: Game[] = [testGame()]) =>
  buildCatalog(
    games,
    [
      { name: 'CPU 200', brand: 'X', year: 2020, month: 1, gamingScore: 200 },
      { name: 'CPU 50', brand: 'X', year: 2020, month: 1, gamingScore: 50 },
      { name: 'CPU 100', brand: 'X', year: 2020, month: 1, gamingScore: 100 },
      { name: 'CPU 150', brand: 'X', year: 2020, month: 1, gamingScore: 150 },
    ],
    [
      { name: 'GPU 40', brand: 'Y', year: 2020, month: 1, rasterScore: 40, vramGB: 4 },
      { name: 'GPU 90', brand: 'Y', year: 2020, month: 1, rasterScore: 90, vramGB: 4 },
      { name: 'GPU 100', brand: 'Y', year: 2020, month: 1, rasterScore: 100, vramGB: 8 },
      { name: 'GPU 300', brand: 'Y', year: 2020, month: 1, rasterScore: 300, vramGB: 16 },
    ],
    [{ sizeGB: 64 }, { sizeGB: 8 }, { sizeGB: 32 }, { sizeGB: 16 }],
  );
