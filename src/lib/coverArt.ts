/**
 * Cover art for games without a Steam version, loaded in the player's browser
 * from English Wikipedia (the MediaWiki API allows cross-origin requests with
 * origin=*). Tries the exact article title first, then a search. Results are
 * cached in localStorage so each cover is looked up only once per browser.
 */
const API = 'https://en.wikipedia.org/w/api.php';
const CACHE_KEY = 'rigdle:covers';
const memory = new Map<string, string | null>();

function readCache(): Record<string, string | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(key: string, url: string | null) {
  try {
    const c = readCache();
    c[key] = url;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

interface PagesResponse {
  query?: { pages?: Record<string, { index?: number; thumbnail?: { source: string } }> };
}

/** First thumbnail in a query response (search results are ordered by `index`). */
export function pickThumbnail(data: PagesResponse): string | null {
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.find((p) => p.thumbnail?.source)?.thumbnail?.source ?? null;
}

async function query(params: Record<string, string>): Promise<string | null> {
  const url = `${API}?${new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '600',
    pilicense: 'any', // cover art is non-free, so allow any license
    ...params,
  })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return pickThumbnail(await res.json());
}

export async function findCover(title: string, searchName: string): Promise<string | null> {
  const key = title;
  if (memory.has(key)) return memory.get(key)!;
  const cached = readCache();
  if (key in cached) {
    memory.set(key, cached[key]);
    return cached[key];
  }
  let src: string | null = null;
  try {
    src = await query({ titles: title, redirects: '1' });
    if (!src) src = await query({ generator: 'search', gsrsearch: `${searchName} video game`, gsrlimit: '3' });
  } catch {
    return null; // network error: don't cache, try again next time
  }
  memory.set(key, src);
  writeCache(key, src);
  return src;
}
