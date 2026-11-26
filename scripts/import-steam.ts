/**
 * Builds public/data/steam-library.json: requirement-based FPS-model numbers
 * for the most-owned Steam games, used by the Build planner's search.
 *
 *   npm run import-steam                      # top 10,000 games
 *   npm run import-steam -- --limit 2000      # fewer
 *   npm run import-steam -- --delay 1600      # ms between store requests
 *
 * Needs internet access to steamspy.com and store.steampowered.com, so run it
 * on your own computer or in GitHub Actions (workflow "Import Steam library").
 * Store responses are cached in .steam-cache/, so an interrupted run resumes
 * where it stopped. The Steam store allows roughly 200 requests per 5 minutes;
 * the default delay keeps under that (about 4 hours for 10,000 games).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRequirements, stripHtml } from './steam-requirements';
import gamesJson from '../src/data/games.json';
import consoleJson from '../src/data/console-games.json';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const LIMIT = arg('limit', 10000);
const DELAY = arg('delay', 1600);
const CACHE = '.steam-cache';
const OUT = 'public/data/steam-library.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
mkdirSync(CACHE, { recursive: true });
mkdirSync('public/data', { recursive: true });

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'rigdle-import/1.0' } });
      if (res.status === 429 || res.status >= 500) {
        const wait = 60_000 * (attempt + 1);
        console.warn(`  ${res.status} from ${new URL(url).host}, waiting ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      // Network errors and non-JSON error pages ("Connection failed…", rate-limit notices): back off and retry.
      if (attempt === 5) throw e;
      const wait = 65_000 * (attempt + 1);
      console.warn(`  ${(e as Error).message.slice(0, 80)} from ${new URL(url).host}, waiting ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw new Error('unreachable');
}

/**
 * Most-owned Steam app ids from SteamSpy (1,000 per page, sorted by owners).
 * SteamSpy allows one "all" request per 60 seconds, so uncached pages are spaced
 * 61 s apart. Only full pages are cached, so a short (rate-limited) page is refetched next time.
 */
async function topAppIds(limit: number): Promise<number[]> {
  const ids: number[] = [];
  let fetched = false;
  for (let page = 0; ids.length < limit && page < 60; page++) {
    const cacheFile = join(CACHE, `steamspy-${page}.json`);
    const cached = existsSync(cacheFile);
    if (!cached && fetched) await sleep(61_000);
    const data = cached ? JSON.parse(readFileSync(cacheFile, 'utf8')) : await getJson(`https://steamspy.com/api.php?request=all&page=${page}`);
    const rows = Object.values((data ?? {}) as Record<string, { appid: number }>);
    if (!cached) {
      fetched = true;
      if (rows.length >= 1000) writeFileSync(cacheFile, JSON.stringify(data));
    }
    if (!rows.length) break;
    ids.push(...rows.map((r) => r.appid));
    console.log(`SteamSpy page ${page}: ${rows.length} apps (${ids.length} total)`);
  }
  return [...new Set(ids)].slice(0, limit);
}

interface StoreData {
  type?: string;
  name?: string;
  release_date?: { date?: string };
  genres?: { description: string }[];
  pc_requirements?: { minimum?: string; recommended?: string } | unknown[];
}

async function storeDetails(id: number): Promise<StoreData | null> {
  const cacheFile = join(CACHE, `${id}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  const data = (await getJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`)) as Record<
    string,
    { success: boolean; data?: StoreData }
  > | null;
  const entry = data?.[id];
  const out = entry?.success && entry.data ? entry.data : null;
  writeFileSync(cacheFile, JSON.stringify(out));
  await sleep(DELAY);
  return out;
}

// Games already curated in src/data keep their hand-tuned numbers.
const curated = new Set(
  [...(gamesJson.items as { steamAppId?: number }[]), ...(consoleJson.items as { steamAppId?: number }[])]
    .map((g) => g.steamAppId)
    .filter(Boolean),
);

async function main() {
  const ids = (await topAppIds(LIMIT)).filter((id) => !curated.has(id));
  console.log(`Fetching store details for ${ids.length} apps (cached ones are instant)…`);
  // [appid, name, year, genre, cpuLoad, gpuLoad, vramGB, ramMinGB, ramRecGB]
  const items: (string | number)[][] = [];
  let skipped = 0;
  // Why apps were skipped, with their requirement lines, to improve the parser (written next to the library).
  const debug: { id: number; name?: string; why: string; cpu?: string; gpu?: string }[] = [];
  for (const [n, id] of ids.entries()) {
    const d = await storeDetails(id).catch((e) => (console.warn(`  ${id}: ${e.message}`), null));
    const req = d && !Array.isArray(d.pc_requirements) ? d.pc_requirements : undefined;
    const r = d?.type === 'game' ? parseRequirements(req as { minimum?: string; recommended?: string }) : null;
    if (!d || !r) {
      skipped++;
      if (debug.length < 400) {
        const text = req ? stripHtml(`${req.recommended ?? ''}\n${req.minimum ?? ''}`) : '';
        const line = (label: RegExp) => text.match(label)?.[1]?.trim().slice(0, 160);
        debug.push({
          id,
          name: d?.name,
          why: !d ? 'no store data' : d.type !== 'game' ? `type ${d.type}` : !req ? 'no pc requirements' : 'unreadable requirements',
          cpu: line(/(?:Processor|CPU)\s*:?\s*([^\n]+)/i),
          gpu: line(/(?:Graphics|Video Card|Video|GPU)\s*:?\s*([^\n]+)/i),
        });
      }
    } else {
      const year = Number(d.release_date?.date?.match(/\d{4}/)?.[0] ?? 0);
      items.push([id, d.name ?? `App ${id}`, year, d.genres?.[0]?.description ?? '', r.cpuLoad, r.gpuLoad, r.vramGB, r.ramMinGB, r.ramRecGB]);
    }
    if ((n + 1) % 250 === 0 || n === ids.length - 1) {
      writeFileSync(OUT, JSON.stringify({ v: 1, generated: new Date().toISOString().slice(0, 10), items }));
      writeFileSync('steam-import-debug.json', JSON.stringify(debug, null, 1));
      console.log(`${n + 1}/${ids.length} checked · ${items.length} usable · ${skipped} skipped (not a game or unreadable requirements)`);
    }
  }
  console.log(`Wrote ${OUT}: ${items.length} games.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
